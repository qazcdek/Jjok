from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import CurrentUserDep
from ..settings import Settings, get_settings
from ..tools.registry import ToolSpec, get_registry
from ..tools.runner import ToolFailure, run_tool

router = APIRouter(prefix="/v1/tools")


def _spec(name: str) -> ToolSpec:
    spec = get_registry().get(name)
    if spec is None or not spec.exposed:
        raise HTTPException(404, {"error": {"code": "not_found", "message": f"도구 없음: {name}"}})
    return spec


@router.post("/{name}")
async def call_tool(
    name: str,
    _user: CurrentUserDep,
    settings: Annotated[Settings, Depends(get_settings)],
    payload: Annotated[dict[str, Any], Body()],
) -> dict:
    """결정적 도구 직접 실행 (DevDocs/05-agent-server.md §1.3). 응답은 도구 출력 그대로."""
    spec = _spec(name)
    try:
        return await run_tool(spec, payload, dev=settings.app_env == "dev")
    except ToolFailure as e:
        raise HTTPException(
            e.status,
            {
                "error": {
                    "code": e.code,
                    "message": e.message,
                    "details": {"retryable": e.retryable},
                }
            },
        ) from e
