"""CLI 도구 실행기: stdin JSON → stdout JSON (DevDocs/05-agent-server.md §4.2)."""

import asyncio
import json
import os
import shutil
from dataclasses import dataclass

from .registry import REPO_ROOT, ToolSpec

# 도구 프로세스에 항상 넘기는 최소 환경. 그 외는 ToolSpec.env 에 적힌 것만.
_BASE_ENV = ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "UV_CACHE_DIR", "SSL_CERT_FILE")


@dataclass
class ToolFailure(Exception):
    status: int
    code: str
    message: str
    retryable: bool = False


def resolve_command(spec: ToolSpec, *, dev: bool) -> list[str]:
    if isinstance(spec.command, list):
        return spec.command
    if shutil.which(spec.command):
        return [spec.command]
    if dev and spec.project:
        project = REPO_ROOT / spec.project
        if project.is_dir():
            return ["uv", "run", "--quiet", "--project", str(project), spec.command]
    raise ToolFailure(503, "tool_unavailable", f"도구를 찾을 수 없습니다: {spec.name}")


def tool_env(spec: ToolSpec) -> dict[str, str]:
    return {k: v for k in (*_BASE_ENV, *spec.env) if (v := os.environ.get(k)) is not None}


# 도구 오류 코드 → HTTP 상태
_STATUS = {"invalid_input": 400, "invalid_json": 400, "upstream_error": 502}


async def run_tool(spec: ToolSpec, payload: dict, *, dev: bool) -> dict:
    cmd = resolve_command(spec, dev=dev)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=tool_env(spec),
    )
    try:
        stdout, _stderr = await asyncio.wait_for(
            proc.communicate(json.dumps(payload, ensure_ascii=False).encode()),
            timeout=spec.timeout_s,
        )
    except TimeoutError as e:
        proc.kill()
        await proc.wait()
        raise ToolFailure(
            504,
            "tool_timeout",
            f"{spec.name} 이(가) {spec.timeout_s}초 안에 끝나지 않았습니다.",
            True,
        ) from e

    lines = [ln for ln in stdout.decode("utf-8", "replace").splitlines() if ln.strip()]
    try:
        if len(lines) != 1:
            raise ValueError(f"stdout 줄 수 {len(lines)}")
        envelope = json.loads(lines[0])
    except ValueError as e:
        raise ToolFailure(502, "tool_protocol_error", f"{spec.name} 출력 형식 오류: {e}") from e

    if envelope.get("ok") is True and isinstance(envelope.get("data"), dict):
        return envelope["data"]
    err = envelope.get("error") or {}
    code = str(err.get("code") or "tool_error")
    raise ToolFailure(
        _STATUS.get(code, 500), code, str(err.get("message") or ""), bool(err.get("retryable"))
    )
