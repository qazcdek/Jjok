"""도구 계약 테스트 (네트워크 없이 확인할 수 있는 것만)."""

import sys

from jjok_toolkit.testing import run_tool

CMD = [sys.executable, "-m", "metadata_lookup.cli"]


def test_schema():
    r = run_tool([*CMD, "--schema"])
    assert r.exit_code == 0
    assert {"doi", "arxiv", "title"} <= set(r.envelope["properties"])


def test_빈_입력은_invalid_input():
    r = run_tool(CMD, {})
    assert r.exit_code == 1
    assert r.envelope["error"]["code"] == "invalid_input"
