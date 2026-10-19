"""도구 계약 테스트 (DevDocs/08-test-strategy.md §1 '도구 계약'). 새 도구도 같은 항목을 검사한다."""

import sys

import pytest
from jjok_toolkit.testing import run_tool

from tool_template.core import Input, run

CMD = [sys.executable, "-m", "tool_template.cli"]


def test_core_는_순수_함수로_호출된다():
    assert run(Input(text="hi", repeat=2)).text == "hi hi"


def test_성공_응답_형식():
    r = run_tool(CMD, {"text": "hi", "repeat": 3})
    assert r.exit_code == 0
    assert r.envelope == {"ok": True, "data": {"text": "hi hi hi"}}


def test_schema_는_입력_스키마를_출력한다():
    r = run_tool([*CMD, "--schema"])
    assert r.exit_code == 0
    schema = r.envelope
    assert schema["type"] == "object"
    assert "text" in schema["properties"]


def test_output_schema_와_version():
    assert "text" in run_tool([*CMD, "--output-schema"]).envelope["properties"]
    assert run_tool([*CMD, "--version"]).envelope["name"] == "tool-template"


@pytest.mark.parametrize(
    ("payload", "code"),
    [
        ({"repeat": 2}, "invalid_input"),
        ({"text": "hi", "repeat": 99}, "invalid_input"),
        ({"text": "   "}, "empty_text"),
    ],
)
def test_실패_응답_형식(payload, code):
    r = run_tool(CMD, payload)
    assert r.exit_code == 1
    err = r.envelope["error"]
    assert err["code"] == code
    assert isinstance(err["message"], str)
    assert err["retryable"] is False


def test_JSON_이_아닌_입력():
    proc = run_tool(CMD, None)
    assert proc.exit_code == 1  # 빈 입력 → {} → text 누락
    assert proc.envelope["error"]["code"] == "invalid_input"


def test_도구_안의_print_는_stdout_을_오염시키지_않는다(monkeypatch):
    # 서브프로세스 대신 같은 프로세스에서 run_cli 를 돌려 redirect 동작을 확인
    import io
    import json

    from jjok_toolkit import run_cli

    from tool_template.core import Output

    def noisy(inp: Input) -> Output:
        print("디버그 출력")
        return Output(text=inp.text)

    out, err = io.StringIO(), io.StringIO()
    monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps({"text": "x"})))
    monkeypatch.setattr(sys, "stdout", out)
    monkeypatch.setattr(sys, "stderr", err)
    run_cli(name="t", version="0", input_model=Input, output_model=Output, handler=noisy, argv=[])
    assert out.getvalue().strip() == '{"ok": true, "data": {"text": "x"}}'
    assert "디버그 출력" in err.getvalue()
