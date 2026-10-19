import pytest

from agent.settings import Settings


def test_healthz_은_인증_없이_동작한다(client):
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "env": "dev"}


def test_me_는_토큰이_없으면_401(client):
    res = client.get("/v1/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthenticated"


def test_me_는_잘못된_토큰이면_401(client, fake_verify):
    res = client.get("/v1/me", headers={"Authorization": "Bearer nope"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthenticated"


def test_me_는_검증된_uid_를_돌려준다(client, fake_verify):
    res = client.get("/v1/me", headers={"Authorization": "Bearer good:alice"})
    assert res.status_code == 200
    assert res.json() == {"uid": "alice", "email": "alice@example.com", "env": "dev"}


@pytest.mark.parametrize(("env", "allowed"), [("dev", True), ("prod", False)])
def test_llama_는_dev_에서만_허용된다(env, allowed):
    assert Settings(app_env=env).llama_allowed is allowed


def test_cors_origins_는_쉼표_구분_문자열을_받는다(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test")
    assert Settings().cors_origins == ["http://a.test", "http://b.test"]


def test_cors_는_허용된_origin_에만_헤더를_준다(client):
    ok = client.options(
        "/v1/me",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options(
        "/v1/me",
        headers={"Origin": "http://evil.test", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad.headers
