import pytest
from fastapi.testclient import TestClient

from agent import auth
from agent.main import create_app
from agent.settings import get_settings


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("APP_ENV", "dev")
    get_settings.cache_clear()
    return TestClient(create_app())


@pytest.fixture
def fake_verify(monkeypatch: pytest.MonkeyPatch):
    """토큰 문자열 'good:<uid>' 만 통과시키는 가짜 검증."""

    def _verify(token: str) -> dict:
        if not token.startswith("good:"):
            raise ValueError("bad token")
        uid = token.removeprefix("good:")
        return {"uid": uid, "email": f"{uid}@example.com"}

    monkeypatch.setattr(auth, "verify_id_token", _verify)
