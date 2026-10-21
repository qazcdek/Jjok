"""POST /v1/tools/{tool}: 인증, 입력 검사, 오류 형식, 속도 제한."""

import httpx
import pytest
from fastapi.testclient import TestClient
from test_metadata_lookup import ARXIV, CROSSREF, OPENALEX, S2, fixture, mock_client

from jjok.api import tools as tools_api
from jjok.http import get_http_client
from jjok.main import create_app
from jjok.settings import get_settings

AUTH = {"Authorization": "Bearer good:alice"}


@pytest.fixture
def make_client(monkeypatch: pytest.MonkeyPatch, fake_verify):
    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.delenv("OPENALEX_API_KEY", raising=False)
    get_settings.cache_clear()

    def _make(routes: dict, limit: int = 60) -> TestClient:
        app = create_app()
        http, _ = mock_client(routes)
        app.dependency_overrides[get_http_client] = lambda: http
        limiter = tools_api.RateLimiter(limit=limit)
        app.dependency_overrides[tools_api.get_rate_limiter] = lambda: limiter
        return TestClient(app)

    return _make


def test_토큰이_없으면_401(make_client):
    res = make_client({}).post("/v1/tools/metadata-lookup", json={"arxiv": "1706.03762"})
    assert res.status_code == 401


def test_없는_도구는_404(make_client):
    res = make_client({}).post("/v1/tools/rm-rf", json={}, headers=AUTH)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("body", [{}, {"title": "  "}, {"doi": 3}, {"arxiv": "x", "extra": 1}])
def test_입력이_잘못되면_400_invalid_request(make_client, body):
    res = make_client({}).post("/v1/tools/metadata-lookup", json=body, headers=AUTH)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_request"


def test_arxiv_ID_로_조회(make_client):
    client = make_client({ARXIV: httpx.Response(200, text=fixture("arxiv_1706.03762.xml"))})
    res = client.post("/v1/tools/metadata-lookup", json={"arxiv": "1706.03762"}, headers=AUTH)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "found"
    assert body["match"]["title"] == "Attention Is All You Need"
    assert body["match"]["arxivVersion"] == 7
    assert "venue" not in body["match"]  # 값 없는 필드는 빼고 보낸다


def test_외부_API_가_모두_실패하면_502_속도제한이면_429(make_client):
    failing = make_client({h: httpx.Response(500) for h in (CROSSREF, OPENALEX, S2)})
    res = failing.post("/v1/tools/metadata-lookup", json={"doi": "10.1/x"}, headers=AUTH)
    assert res.status_code == 502 and res.json()["error"]["code"] == "upstream_error"

    limited = make_client({h: httpx.Response(429) for h in (CROSSREF, OPENALEX, S2)})
    res = limited.post("/v1/tools/metadata-lookup", json={"doi": "10.1/x"}, headers=AUTH)
    assert res.status_code == 429 and res.json()["error"]["code"] == "upstream_rate_limited"


def test_사용자별_속도_제한(make_client):
    client = make_client(
        {ARXIV: httpx.Response(200, text=fixture("arxiv_1706.03762.xml"))}, limit=2
    )
    codes = [
        client.post(
            "/v1/tools/metadata-lookup", json={"arxiv": "1706.03762"}, headers=AUTH
        ).status_code
        for _ in range(3)
    ]
    assert codes == [200, 200, 429]
