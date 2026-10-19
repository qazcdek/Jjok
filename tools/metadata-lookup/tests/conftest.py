from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

FIXTURES = Path(__file__).parent / "fixtures"

Route = Callable[[httpx.Request], httpx.Response | None]


def fixture(name: str, content_type: str = "application/json") -> httpx.Response:
    return httpx.Response(
        200, content=(FIXTURES / name).read_bytes(), headers={"Content-Type": content_type}
    )


ATOM = "application/atom+xml"
EMPTY_ATOM = (
    b'<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>empty</title></feed>'
)


def default_routes(req: httpx.Request) -> httpx.Response | None:
    url = str(req.url)
    host = req.url.host
    if host == "export.arxiv.org":
        if "id_list=1706.03762" in url:
            return fixture("arxiv_id_1706.03762.xml", ATOM)
        if "search_query" in url and "Residual" in req.url.params.get("search_query", ""):
            return fixture("arxiv_title_resnet.xml", ATOM)
        return httpx.Response(200, content=EMPTY_ATOM, headers={"Content-Type": ATOM})
    if host == "api.crossref.org":
        path = req.url.path.lower()
        if path.endswith("10.1109/cvpr.2016.90"):
            return fixture("crossref_10.1109_cvpr.2016.90.json")
        if path.endswith("10.18653/v1/n19-1423"):
            return fixture("crossref_10.18653_v1_n19-1423.json")
        return httpx.Response(404, json={"status": "error"})
    if host == "api.openalex.org":
        if "Residual" in req.url.params.get("search", ""):
            return fixture("openalex_search_resnet.json")
        return httpx.Response(200, json={"results": []})
    if host == "api.semanticscholar.org":
        return httpx.Response(429, json={"message": "Too Many Requests"})
    return None


@pytest.fixture
def make_client():
    """routes 가 None 을 돌려주면 기본 고정 응답으로 넘어간다."""

    def _make(*routes: Route) -> httpx.Client:
        def handler(req: httpx.Request) -> httpx.Response:
            for r in (*routes, default_routes):
                res = r(req)
                if res is not None:
                    return res
            raise AssertionError(f"예상하지 못한 요청: {req.url}")

        return httpx.Client(transport=httpx.MockTransport(handler))

    return _make


@pytest.fixture(autouse=True)
def _no_s2_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("S2_API_KEY", raising=False)
