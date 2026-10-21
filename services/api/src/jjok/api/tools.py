"""POST /v1/tools/{tool}: 결정적 도구 직접 실행 (DevDocs/05-agent-server.md §1.3).

요청 본문은 도구 입력 스키마, 응답은 도구 출력 그대로. 서버는 인증·속도 제한·타임아웃만 덧붙인다.
"""

import asyncio
import time
from collections import defaultdict, deque
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import ValidationError

from ..auth import CurrentUserDep
from ..http import get_http_client
from ..settings import Settings, get_settings
from ..tools.builtin.metadata_lookup.core import LookupFailed
from ..tools.registry import TOOLS, ToolContext, ToolInputError

router = APIRouter(prefix="/v1")


def _error(status: int, code: str, message: str, details: Any = None) -> HTTPException:
    body: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        body["details"] = details
    return HTTPException(status_code=status, detail={"error": body})


class RateLimiter:
    """사용자별 고정 창 대신 최근 window 초의 호출 수를 센다. 인스턴스 하나 안에서만 유효하다."""

    def __init__(self, limit: int, window_s: float = 60):
        self.limit, self.window_s = limit, window_s
        self._calls: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        calls = self._calls[key]
        while calls and now - calls[0] > self.window_s:
            calls.popleft()
        if len(calls) >= self.limit:
            return False
        calls.append(now)
        return True


_limiter = RateLimiter(limit=60)


def get_rate_limiter() -> RateLimiter:
    return _limiter


@router.post("/tools/{tool}")
async def run_tool(
    tool: str,
    user: CurrentUserDep,
    body: Annotated[dict[str, Any], Body()],
    client: Annotated[httpx.AsyncClient, Depends(get_http_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
) -> dict[str, Any]:
    spec = TOOLS.get(tool)
    if spec is None or not spec.exposed:
        raise _error(404, "not_found", f"도구가 없습니다: {tool}")
    if not limiter.allow(user.uid):
        raise _error(429, "rate_limited", "요청이 너무 많습니다. 잠시 후 다시 시도하세요.")
    try:
        req = spec.input_model.model_validate(body)
    except ValidationError as e:
        raise _error(
            400, "invalid_request", "입력이 올바르지 않습니다.", e.errors(include_url=False)
        ) from e

    ctx = ToolContext(uid=user.uid, client=client, settings=settings)
    try:
        out = await asyncio.wait_for(spec.run(req, ctx), timeout=spec.timeout_s)
    except ToolInputError as e:
        raise _error(400, "invalid_request", str(e)) from e
    except TimeoutError as e:
        raise _error(502, "upstream_error", "외부 서비스 응답이 너무 늦습니다.") from e
    except LookupFailed as e:
        if e.rate_limited:
            raise _error(429, "upstream_rate_limited", "외부 서비스 호출 한도를 넘었습니다.") from e
        raise _error(502, "upstream_error", "외부 서비스 호출에 실패했습니다.") from e
    return out.model_dump(mode="json", exclude_none=True)
