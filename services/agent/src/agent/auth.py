"""Firebase ID 토큰 검증. DevDocs/04-security.md §1

FIREBASE_AUTH_EMULATOR_HOST 가 설정되어 있으면 Admin SDK 가 에뮬레이터 토큰을 받아들인다.
"""

from dataclasses import dataclass
from typing import Annotated

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as fb_auth

from .settings import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    uid: str
    email: str | None


def init_firebase(settings: Settings) -> firebase_admin.App:
    try:
        return firebase_admin.get_app()
    except ValueError:
        return firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})


def verify_id_token(token: str) -> dict:
    """테스트에서 바꿔 끼울 수 있도록 분리한 검증 함수."""
    return fb_auth.verify_id_token(token)


def _unauthenticated(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "unauthenticated", "message": message}},
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise _unauthenticated("로그인이 필요합니다.")
    init_firebase(settings)
    try:
        claims = verify_id_token(creds.credentials)
    except Exception as e:  # 만료·서명 오류 등: 원인은 로그에만 남기고 응답은 단순하게
        raise _unauthenticated("유효하지 않은 인증 토큰입니다.") from e
    return CurrentUser(uid=claims["uid"], email=claims.get("email"))


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
