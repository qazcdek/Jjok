import json
import sys

import pytest

from agent.tools import registry as registry_mod
from agent.tools.registry import ToolSpec, load_registry
from agent.tools.runner import ToolFailure, resolve_command, run_tool, tool_env

ECHO = [
    sys.executable,
    "-c",
    "import sys,json; print(json.dumps({'ok': True, 'data': json.load(sys.stdin)}))",
]


def spec(**kw) -> ToolSpec:
    return ToolSpec(**{"name": "t", "command": ECHO, "exposed": True, **kw})


async def test_도구_출력의_data_를_돌려준다():
    assert await run_tool(spec(), {"a": 1}, dev=True) == {"a": 1}


async def test_도구_오류는_코드와_상태로_바뀐다():
    fail = [
        sys.executable,
        "-c",
        (
            "import json; print(json.dumps({'ok': False, 'error': "
            "{'code': 'upstream_error', 'message': 'down', 'retryable': True}}));"
            "raise SystemExit(1)"
        ),
    ]
    with pytest.raises(ToolFailure) as e:
        await run_tool(spec(command=fail), {}, dev=True)
    assert (e.value.status, e.value.code, e.value.retryable) == (502, "upstream_error", True)


async def test_stdout_이_오염되면_프로토콜_오류():
    noisy = [sys.executable, "-c", "print('debug'); print('{}')"]
    with pytest.raises(ToolFailure) as e:
        await run_tool(spec(command=noisy), {}, dev=True)
    assert e.value.code == "tool_protocol_error"


async def test_시간_초과면_프로세스를_죽이고_504():
    slow = [sys.executable, "-c", "import time; time.sleep(5)"]
    with pytest.raises(ToolFailure) as e:
        await run_tool(spec(command=slow, timeout_s=0.5), {}, dev=True)
    assert (e.value.status, e.value.code) == (504, "tool_timeout")


def test_도구에는_허용된_환경_변수만_넘긴다(monkeypatch):
    monkeypatch.setenv("S2_API_KEY", "k")
    monkeypatch.setenv("SECRET_THING", "nope")
    env = tool_env(spec(env=["S2_API_KEY"]))
    assert env["S2_API_KEY"] == "k"
    assert "SECRET_THING" not in env


def test_PATH_에_없으면_dev_에서만_uv_run_으로_실행한다():
    s = ToolSpec(
        name="metadata-lookup", command="no-such-binary-xyz", project="tools/metadata-lookup"
    )
    cmd = resolve_command(s, dev=True)
    assert cmd[:4] == ["uv", "run", "--quiet", "--project"] and cmd[-1] == "no-such-binary-xyz"
    with pytest.raises(ToolFailure) as e:
        resolve_command(s, dev=False)
    assert e.value.code == "tool_unavailable"


def test_저장소_레지스트리를_읽는다():
    reg = load_registry()
    assert reg["metadata-lookup"].exposed
    assert reg["metadata-lookup"].env == ["S2_API_KEY"]


@pytest.fixture
def echo_registry(monkeypatch):
    reg = {"echo": spec(name="echo"), "hidden": spec(name="hidden", exposed=False)}
    monkeypatch.setattr(registry_mod, "get_registry", lambda: reg)
    from agent.api import tools as tools_api

    monkeypatch.setattr(tools_api, "get_registry", lambda: reg)
    return reg


def test_API_는_인증이_필요하다(client, echo_registry):
    assert client.post("/v1/tools/echo", json={}).status_code == 401


def test_API_로_도구를_실행한다(client, fake_verify, echo_registry):
    res = client.post("/v1/tools/echo", json={"q": "x"}, headers={"Authorization": "Bearer good:a"})
    assert res.status_code == 200
    assert res.json() == {"q": "x"}


def test_노출되지_않은_도구는_404(client, fake_verify, echo_registry):
    res = client.post("/v1/tools/hidden", json={}, headers={"Authorization": "Bearer good:a"})
    assert res.status_code == 404
    assert json.loads(res.text)["error"]["code"] == "not_found"
