import httpx
import pytest
from jjok_toolkit import ToolError

from metadata_lookup.core import run
from metadata_lookup.models import Input
from metadata_lookup.venue import normalize_venue


def test_arxiv_ID_로_프리프린트_정보를_가져온다(make_client):
    out = run(Input(arxiv="1706.03762"), make_client())
    assert out.status == "found"
    m = out.metadata
    assert m is not None
    assert m.title == "Attention Is All You Need"
    assert m.kind == "preprint"
    assert m.year == 2017
    assert m.ids.arxiv == "1706.03762"
    assert m.authors[0].name == "Ashish Vaswani"
    assert m.authors[0].family == "Vaswani"
    assert len(m.authors) == 8


def test_DOI_로_학회판_정보를_가져온다(make_client):
    out = run(Input(doi="10.1109/CVPR.2016.90"), make_client())
    m = out.metadata
    assert out.status == "found" and m is not None
    assert m.title == "Deep Residual Learning for Image Recognition"
    assert (m.venue, m.kind, m.year) == ("CVPR", "conference", 2016)
    assert m.ids.doi == "10.1109/cvpr.2016.90"
    assert [a.family for a in m.authors] == ["He", "Zhang", "Ren", "Sun"]


def test_NAACL_긴_이름을_정규화한다(make_client):
    out = run(Input(doi="10.18653/v1/N19-1423"), make_client())
    m = out.metadata
    assert m is not None
    assert (m.venue, m.kind, m.year) == ("NAACL", "conference", 2019)


def test_제목_검색은_출판판을_대표로_하고_arXiv_ID_를_합친다(make_client):
    out = run(
        Input(title="Deep Residual Learning for Image Recognition", firstAuthor="He"), make_client()
    )
    m = out.metadata
    assert out.status == "found" and m is not None
    assert (m.venue, m.kind) == ("CVPR", "conference")
    assert m.ids.doi == "10.1109/cvpr.2016.90"
    assert m.ids.arxiv == "1512.03385"
    # 키가 없으면 S2 는 호출하지 않는다 (경고도 없음)
    assert not any("s2" in w for w in out.warnings)


def test_비슷한_제목만_있으면_ambiguous(make_client):
    out = run(
        Input(title="Deep Residual Learning for Image Recognition: A Survey of Methods"),
        make_client(),
    )
    assert out.status == "ambiguous"
    assert out.candidates


def test_결과가_없으면_not_found(make_client):
    out = run(Input(title="A Completely Unknown Paper Title Zzz"), make_client())
    assert out.status == "not_found"
    assert out.metadata is None


def test_DOI_가_없으면_arXiv_로_넘어간다(make_client):
    out = run(Input(doi="10.9999/missing", arxiv="1706.03762"), make_client())
    assert out.metadata is not None and out.metadata.source == "arxiv"


def test_arXiv_가_실패하면_S2_로_넘어간다(make_client):
    s2_paper = {
        "paperId": "abc",
        "title": "Attention Is All You Need",
        "authors": [{"name": "Ashish Vaswani"}],
        "year": 2017,
        "venue": "Neural Information Processing Systems",
        "publicationTypes": ["Conference"],
        "externalIds": {"ArXiv": "1706.03762", "DBLP": "conf/nips/VaswaniSPUJGKP17"},
    }

    def routes(req: httpx.Request):
        if req.url.host == "export.arxiv.org":
            return httpx.Response(503)
        if req.url.host == "api.semanticscholar.org":
            return httpx.Response(200, json=s2_paper)
        return None

    out = run(Input(arxiv="1706.03762"), make_client(routes))
    m = out.metadata
    assert m is not None and m.source == "s2"
    assert (m.venue, m.kind) == ("NeurIPS", "conference")
    assert m.ids.dblp == "conf/nips/VaswaniSPUJGKP17"
    assert any("arxiv: HTTP 503" in w for w in out.warnings)


def test_S2_키가_있으면_외부_ID_를_보강한다(make_client, monkeypatch):
    monkeypatch.setenv("S2_API_KEY", "test-key")
    seen: list[str | None] = []

    def routes(req: httpx.Request):
        if req.url.host == "api.semanticscholar.org":
            seen.append(req.headers.get("x-api-key"))
            return httpx.Response(
                200, json={"paperId": "s2id", "title": "x", "externalIds": {"DBLP": "d"}}
            )
        return None

    out = run(Input(arxiv="1706.03762"), make_client(routes))
    assert out.metadata is not None
    assert (out.metadata.ids.s2, out.metadata.ids.dblp) == ("s2id", "d")
    assert seen == ["test-key"]


def test_모든_소스가_실패하면_재시도_가능한_오류(make_client):
    def down(_req: httpx.Request):
        return httpx.Response(503)

    with pytest.raises(ToolError) as e:
        run(Input(title="Anything At All"), make_client(down))
    assert e.value.code == "upstream_error"
    assert e.value.retryable


def test_입력이_하나도_없으면_검증_오류():
    with pytest.raises(ValueError):
        Input()


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Advances in Neural Information Processing Systems 30", "NeurIPS"),
        ("2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)", "CVPR"),
        ("International Conference on Learning Representations", "ICLR"),
        (
            "Proceedings of the 58th Annual Meeting of the "
            "Association for Computational Linguistics",
            "ACL",
        ),
        ("Some Small Venue", "Some Small Venue"),
        (None, None),
    ],
)
def test_venue_정규화(raw, expected):
    assert normalize_venue(raw) == expected
