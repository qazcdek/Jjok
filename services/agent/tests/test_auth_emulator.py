"""Auth 에뮬레이터로 실제 ID 토큰을 발급받아 Admin SDK 검증 경로를 확인한다.

실행: firebase emulators:exec --only auth "uv run pytest -m emulator"
"""

import os
import uuid

import httpx
import pytest

pytestmark = [
    pytest.mark.emulator,
    pytest.mark.skipif(
        not os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"),
        reason="FIREBASE_AUTH_EMULATOR_HOST 가 없음",
    ),
]


def _sign_up() -> tuple[str, str]:
    host = os.environ["FIREBASE_AUTH_EMULATOR_HOST"]
    email = f"{uuid.uuid4().hex[:8]}@example.com"
    res = httpx.post(
        f"http://{host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key",
        json={"email": email, "password": "password123", "returnSecureToken": True},
    )
    res.raise_for_status()
    body = res.json()
    return body["idToken"], body["localId"]


def test_에뮬레이터_토큰으로_me_호출(client):
    token, uid = _sign_up()
    res = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    assert res.json()["uid"] == uid


def test_변조된_토큰은_거부된다(client):
    token, _ = _sign_up()
    header, payload, sig = token.split(".")
    tampered = f"{header}.{payload[:-4]}AAAA.{sig}"
    res = client.get("/v1/me", headers={"Authorization": f"Bearer {tampered}"})
    assert res.status_code == 401
