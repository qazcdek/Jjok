"""stdin JSON → stdout JSON 계약 구현.

- 성공: 종료 코드 0, {"ok": true, "data": {...}}
- 실패: 종료 코드 1, {"ok": false, "error": {"code", "message", "retryable"}}
- --schema / --output-schema / --version
- stdout 에는 결과 JSON 한 줄만 쓴다. 처리 중 print 는 stderr 로 돌린다.
"""

import argparse
import contextlib
import json
import sys
import traceback
from collections.abc import Callable
from typing import NoReturn

from pydantic import BaseModel, ValidationError


class ToolError(Exception):
    """도구 로직에서 의도적으로 내는 오류. 그대로 오류 응답이 된다."""

    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


def _emit(payload: dict, out) -> None:
    out.write(json.dumps(payload, ensure_ascii=False))
    out.write("\n")
    out.flush()


def _fail(code: str, message: str, retryable: bool, out) -> NoReturn:
    _emit({"ok": False, "error": {"code": code, "message": message, "retryable": retryable}}, out)
    sys.exit(1)


def run_cli[I: BaseModel, O: BaseModel](
    *,
    name: str,
    version: str,
    input_model: type[I],
    output_model: type[O],
    handler: Callable[[I], O],
    argv: list[str] | None = None,
) -> None:
    parser = argparse.ArgumentParser(prog=name, description=f"{name} (stdin JSON → stdout JSON)")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--schema", action="store_true", help="입력 JSON Schema 출력")
    group.add_argument("--output-schema", action="store_true", help="출력 JSON Schema 출력")
    group.add_argument("--version", action="store_true", help="도구 버전 출력")
    args = parser.parse_args(argv)

    out = sys.stdout
    if args.schema:
        _emit(input_model.model_json_schema(), out)
        return
    if args.output_schema:
        _emit(output_model.model_json_schema(), out)
        return
    if args.version:
        _emit({"name": name, "version": version}, out)
        return

    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as e:
        _fail("invalid_json", f"입력이 JSON 이 아닙니다: {e}", False, out)
    try:
        inp = input_model.model_validate(payload)
    except ValidationError as e:
        _fail("invalid_input", e.json(include_url=False), False, out)

    try:
        # 도구 코드의 print 가 결과를 오염시키지 않도록 stdout 을 stderr 로 돌린다
        with contextlib.redirect_stdout(sys.stderr):
            result = handler(inp)
    except ToolError as e:
        _fail(e.code, e.message, e.retryable, out)
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        _fail("internal_error", f"{type(e).__name__}: {e}", False, out)

    _emit({"ok": True, "data": output_model.model_validate(result).model_dump(mode="json")}, out)
