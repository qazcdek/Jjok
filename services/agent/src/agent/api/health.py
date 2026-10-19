from typing import Annotated

from fastapi import APIRouter, Depends

from ..settings import Settings, get_settings

router = APIRouter()


@router.get("/healthz")
def healthz(settings: Annotated[Settings, Depends(get_settings)]) -> dict:
    return {"status": "ok", "env": settings.app_env}
