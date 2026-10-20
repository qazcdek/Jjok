from typing import Annotated

from fastapi import APIRouter, Depends

from ..auth import CurrentUserDep
from ..settings import Settings, get_settings

router = APIRouter(prefix="/v1")


@router.get("/me")
def me(user: CurrentUserDep, settings: Annotated[Settings, Depends(get_settings)]) -> dict:
    """인증 연결 확인용 (M0-10)."""
    return {"uid": user.uid, "email": user.email, "env": settings.app_env}
