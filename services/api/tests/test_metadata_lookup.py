"""metadata-lookup: 응답 변환과 조회 순서.

외부 API 는 저장해 둔 실제 응답(fixtures/metadata)으로 흉내 낸다.
"""

import json
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

from jjok.schema.metadata_lookup_input_schema import MetadataLookupInput
from jjok.tools.builtin.metadata_lookup import providers as p
from jjok.tools.builtin.metadata_lookup.core import LookupFailed, lookup
from jjok.tools.builtin.metadata_lookup.titles import normalize_title, title_similarity

FIX = Path(__file__).parent / "fixtures" / "metadata"
EMPTY_FEED = '<feed xmlns="http://www.w3.org/2005/Atom"></feed>'


def fixture(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


def fixture_json(name: str) -> dict:
    return json.loads(fixture(name))


def inp(**fields: str) -> MetadataLookupInput:
    return MetadataLookupInput.model_validate(fields)


Handler = Callable[[httpx.Request], httpx.Response]


def mock_client(routes: dict[str, Handler | httpx.Response]) -> tuple[httpx.AsyncClient, list]:
    """호스트 이름으로 응답을 고르는 클라이언트. 없는 호스트는 404. 받은 요청을 기록한다."""
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        route = routes.get(request.url.host)
        if route is None:
            return httpx.Response(404)
        return route(request) if callable(route) else route

    return httpx.AsyncClient(transport=httpx.MockTransport(handler)), seen


ARXIV = "export.arxiv.org"
CROSSREF = "api.crossref.org"
OPENALEX = "api.openalex.org"
S2 = "api.semanticscholar.org"
NO_KEYS = p.Keys()


# --- 응답 변환 ---------------------------------------------------------------------------


def test_arxiv_응답에서_제목_저자_연도_버전을_읽는다():
    m = p.parse_arxiv(fixture("arxiv_1706.03762.xml"))
    assert m is not None
    assert m.title == "Attention Is All You Need"
    assert [a.name for a in m.authors][:2] == ["Ashish Vaswani", "Noam Shazeer"]
    assert m.authors[0].family == "Vaswani"
    assert (m.year, m.kind, m.arxivVersion) == (2017, "preprint", 7)
    assert m.ids.arxiv == "1706.03762"
    assert m.abstract and m.abstract.startswith("The dominant sequence")


def test_arxiv_항목이_없으면_None():
    assert p.parse_arxiv(EMPTY_FEED) is None


def test_crossref_학회_논문은_conference():
    m = p.parse_crossref(fixture_json("crossref_cvpr.2016.90.json"))
    assert m is not None
    assert m.title == "Deep Residual Learning for Image Recognition"
    assert (m.kind, m.year) == ("conference", 2016)
    assert m.venue == "2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)"
    assert (m.authors[0].given, m.authors[0].family) == ("Kaiming", "He")
    assert m.ids.doi == "10.1109/cvpr.2016.90"


def test_openalex_검색_결과_종류와_식별자():
    results = fixture_json("oa_search.json")["results"]
    conf, preprint, journal = (p.parse_openalex(w, "title-search") for w in results)
    assert conf and conf.kind == "conference" and conf.ids.doi == "10.1109/cvpr.2016.90"
    assert conf.ids.openalex == "W2194775991"
    # arXiv DOI 는 arxiv 로 옮기고, 저장소(arXiv)는 학회·저널로 쓰지 않는다
    assert preprint and preprint.kind == "preprint" and preprint.venue is None
    assert preprint.ids.arxiv == "1512.03385" and preprint.ids.doi is None
    assert journal and journal.kind == "journal" and journal.venue == "Applied Sciences"
    assert conf.abstract is None or isinstance(conf.abstract, str)


def test_s2_응답_변환():
    m = p.parse_s2(fixture_json("s2_cvpr.2016.90.json"), "identifier")
    assert m is not None
    assert m.ids.arxiv == "1512.03385" and m.ids.dblp == "conf/cvpr/HeZRS16"
    assert m.kind == "conference"


@pytest.mark.parametrize(
    ("a", "b", "close"),
    [
        ("Attention Is All You Need", "attention is all you need.", True),
        (
            "BERT: Pre-training of Deep Bidirectional Transformers",
            "BERT Pre training of deep bidirectional transformers",
            True,
        ),
        ("Deep Residual Learning", "Deep Residual Learning for Image Recognition: A Survey", False),
    ],
)
def test_제목_유사도(a, b, close):
    assert (title_similarity(a, b) >= 0.9) is close


def test_제목_정규화는_웹과_같다():
    assert normalize_title("  LoRA: Low-Rank   Adaptation (v2)! ") == "lora low rank adaptation v2"


# --- 조회 순서 ---------------------------------------------------------------------------


async def test_arxiv_ID_는_arxiv_API_만_부른다():
    client, seen = mock_client({ARXIV: httpx.Response(200, text=fixture("arxiv_1706.03762.xml"))})
    out = await lookup(inp(arxiv="1706.03762", title="ignored"), client, NO_KEYS)
    assert out.status == "found" and out.match and out.match.source == "arxiv"
    assert [t.outcome for t in out.tried] == ["found"]
    assert len(seen) == 1 and seen[0].url.params["id_list"] == "1706.03762"


async def test_arxiv_DOI_는_arxiv_로_조회한다():
    client, _ = mock_client({ARXIV: httpx.Response(200, text=fixture("arxiv_1706.03762.xml"))})
    out = await lookup(inp(doi="10.48550/arXiv.1706.03762"), client, NO_KEYS)
    assert out.match and out.match.source == "arxiv"


async def test_crossref_가_실패하면_openalex_로_넘어간다():
    work = fixture_json("oa_search.json")["results"][0]
    client, seen = mock_client(
        {CROSSREF: httpx.Response(503), OPENALEX: httpx.Response(200, json=work)}
    )
    out = await lookup(inp(doi="10.1109/CVPR.2016.90"), client, p.Keys(openalex="k-123"))
    assert out.status == "found" and out.match and out.match.source == "openalex"
    assert [(t.source, t.outcome) for t in out.tried] == [
        ("crossref", "error"),
        ("openalex", "found"),
    ]
    oa = seen[1].url
    assert oa.path == "/works/doi:10.1109/cvpr.2016.90" and oa.params["api_key"] == "k-123"


async def test_식별자로_못_찾으면_제목으로_검색해_가장_비슷한_것을_고른다():
    client, seen = mock_client(
        {
            ARXIV: httpx.Response(200, text=EMPTY_FEED),
            OPENALEX: httpx.Response(200, json=fixture_json("oa_search.json")),
        }
    )
    out = await lookup(
        inp(arxiv="9999.99999", title="Deep residual learning for image recognition"),
        client,
        NO_KEYS,
    )
    assert out.status == "found" and out.match
    assert out.match.method == "title-search" and out.match.score == 1.0
    assert out.match.kind == "conference"  # 같은 점수면 검색 순서 (OpenAlex 관련도) 유지
    scores = [c.score or 0 for c in out.candidates]
    assert scores == sorted(scores, reverse=True)
    assert seen[1].url.params["search"] == "Deep residual learning for image recognition"


async def test_비슷한_제목이_없으면_ambiguous():
    client, _ = mock_client({OPENALEX: httpx.Response(200, json=fixture_json("oa_search.json"))})
    out = await lookup(inp(title="Residual networks"), client, NO_KEYS)
    assert out.status == "ambiguous" and out.match is None and len(out.candidates) == 3


async def test_openalex_검색이_비면_s2_제목_매칭():
    s2 = fixture_json("s2_cvpr.2016.90.json")
    client, seen = mock_client(
        {
            OPENALEX: httpx.Response(200, json={"results": []}),
            S2: httpx.Response(200, json={"data": [s2]}),
        }
    )
    out = await lookup(
        inp(title="Deep Residual Learning for Image Recognition"),
        client,
        p.Keys(s2="s2-key"),
    )
    assert out.match and out.match.source == "s2"
    assert seen[-1].headers["x-api-key"] == "s2-key"


async def test_아무것도_없으면_not_found():
    client, _ = mock_client({ARXIV: httpx.Response(200, text=EMPTY_FEED)})
    out = await lookup(inp(arxiv="9999.99999"), client, NO_KEYS)
    assert out.status == "not_found" and out.tried[0].outcome == "not_found"


async def test_모두_실패하면_LookupFailed_속도제한이면_표시한다():
    client, _ = mock_client(
        {CROSSREF: httpx.Response(500), OPENALEX: httpx.Response(429), S2: httpx.Response(429)}
    )
    with pytest.raises(LookupFailed) as e:
        await lookup(inp(doi="10.1/x"), client, NO_KEYS)
    assert e.value.rate_limited is True


async def test_연결_오류도_다음_곳으로_넘어간다():
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    client, _ = mock_client(
        {
            CROSSREF: boom,
            OPENALEX: httpx.Response(200, json=fixture_json("oa_search.json")["results"][0]),
        }
    )
    out = await lookup(inp(doi="10.1109/cvpr.2016.90"), client, NO_KEYS)
    assert out.match and out.match.source == "openalex"
