"""외부 메타데이터 API 호출과 응답 변환: arXiv, Crossref, OpenAlex, Semantic Scholar.

각 함수는 찾으면 PaperMetadata, 없으면 None (검색은 빈 목록) 을 돌려준다.
속도 제한(429)은 RateLimited, 그 밖의 실패(5xx, 연결·형식 오류)는 UpstreamError 를 던진다.
"""

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote
from xml.etree.ElementTree import Element

import httpx
from defusedxml import ElementTree

from ....schema.common_schema import ExternalIds
from ....schema.metadata_lookup_output_schema import Author, PaperMetadata

ARXIV_API = "https://export.arxiv.org/api/query"
CROSSREF_API = "https://api.crossref.org/works"
OPENALEX_API = "https://api.openalex.org/works"
S2_API = "https://api.semanticscholar.org/graph/v1/paper"
S2_FIELDS = "title,authors,year,venue,externalIds,abstract,publicationTypes"


class UpstreamError(Exception):
    """외부 API 실패."""


class RateLimited(UpstreamError):
    """외부 API 가 429 를 돌려줬다."""


@dataclass(frozen=True)
class Keys:
    """서버 전용 외부 API 키. 없으면 키 없이 호출한다."""

    openalex: str | None = None
    s2: str | None = None
    crossref_mailto: str | None = None


async def _get(client: httpx.AsyncClient, url: str, **kwargs: Any) -> httpx.Response | None:
    """GET. 404 는 None, 429 는 RateLimited, 그 밖의 오류는 UpstreamError."""
    try:
        res = await client.get(url, **kwargs)
    except httpx.HTTPError as e:
        raise UpstreamError(f"{url}: {type(e).__name__}") from e
    if res.status_code == 404:
        return None
    if res.status_code == 429:
        raise RateLimited(url)
    if res.status_code >= 400:
        raise UpstreamError(f"{url}: HTTP {res.status_code}")
    return res


def _json(res: httpx.Response) -> Any:
    try:
        return res.json()
    except ValueError as e:
        raise UpstreamError(f"{res.url}: JSON 아님") from e


def _clean(text: str | None) -> str | None:
    if text is None:
        return None
    cleaned = " ".join(text.split())
    return cleaned or None


def _paper(**fields: Any) -> PaperMetadata:
    # 생성 모델의 Field(None, ...) 기본값을 pyright 가 인식하지 못해 dict 로 검증한다
    return PaperMetadata.model_validate({k: v for k, v in fields.items() if v is not None})


def _split_name(name: str) -> Author:
    parts = name.split()
    if len(parts) < 2:
        return Author(name=name)
    return Author(name=name, given=" ".join(parts[:-1]), family=parts[-1])


def _strip_doi(doi: str | None) -> str | None:
    if not doi:
        return None
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.I).lower()


_ARXIV_DOI = re.compile(r"^10\.48550/arxiv\.(.+)$", re.I)


def arxiv_id_from_doi(doi: str) -> str | None:
    """arXiv DOI(10.48550/arXiv.<id>)면 arXiv ID."""
    m = _ARXIV_DOI.match(doi)
    return m.group(1) if m else None


def _ids(*, doi: str | None = None, arxiv: str | None = None, **others: str | None) -> ExternalIds:
    """arXiv DOI 는 doi 대신 arxiv 로 넣는다."""
    doi = _strip_doi(doi)
    if doi and (from_doi := arxiv_id_from_doi(doi)):
        arxiv = arxiv or from_doi
        doi = None
    values = {"doi": doi, "arxiv": arxiv, **others}
    return ExternalIds(**{k: v for k, v in values.items() if v})


# --- arXiv -------------------------------------------------------------------------------

_ATOM = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
_ARXIV_ABS = re.compile(r"arxiv\.org/abs/(.+?)(?:v(\d+))?$")


def parse_arxiv(xml: str) -> PaperMetadata | None:
    try:
        root: Element = ElementTree.fromstring(xml)
    except ElementTree.ParseError as e:
        raise UpstreamError("arXiv: XML 형식 오류") from e
    entry = root.find("a:entry", _ATOM)
    if entry is None:
        return None
    m = _ARXIV_ABS.search(entry.findtext("a:id", "", _ATOM))
    title = _clean(entry.findtext("a:title", None, _ATOM))
    if not m or not title:
        return None  # 잘못된 ID 는 오류 항목으로 온다
    published = entry.findtext("a:published", "", _ATOM)
    return _paper(
        source="arxiv",
        method="identifier",
        title=title,
        authors=[
            _split_name(n)
            for a in entry.findall("a:author", _ATOM)
            if (n := _clean(a.findtext("a:name", None, _ATOM)))
        ],
        year=int(published[:4]) if published[:4].isdigit() else None,
        abstract=_clean(entry.findtext("a:summary", None, _ATOM)),
        kind="preprint",
        # arxiv:doi 는 출판본 DOI. 이 PDF(프리프린트)의 DOI 는 아니지만 같은 논문이라 함께 둔다
        ids=_ids(arxiv=m.group(1), doi=entry.findtext("arxiv:doi", None, _ATOM)),
        arxivVersion=int(m.group(2)) if m.group(2) else None,
    )


async def arxiv_by_id(client: httpx.AsyncClient, arxiv_id: str) -> PaperMetadata | None:
    res = await _get(client, ARXIV_API, params={"id_list": arxiv_id, "max_results": 1})
    return parse_arxiv(res.text) if res else None


# --- Crossref ----------------------------------------------------------------------------


def _crossref_kind(work: dict[str, Any], venue: str | None) -> Any:
    kind = work.get("type")
    if kind == "proceedings-article":
        return "workshop" if venue and "workshop" in venue.lower() else "conference"
    if kind == "journal-article":
        return "journal"
    if kind == "posted-content":
        return "preprint"
    return "other"


def parse_crossref(data: dict[str, Any]) -> PaperMetadata | None:
    work = data.get("message") or {}
    title = _clean(next(iter(work.get("title") or []), None))
    if not title:
        return None
    venue = _clean(next(iter(work.get("container-title") or []), None))
    if not venue:
        venue = _clean((work.get("event") or {}).get("name"))
    year = None
    for key in ("published", "issued", "published-print", "published-online"):
        parts = (work.get(key) or {}).get("date-parts") or [[None]]
        first = parts[0][0] if parts and parts[0] else None
        if isinstance(first, int):
            year = first
            break
    authors = []
    for a in work.get("author") or []:
        given, family = _clean(a.get("given")), _clean(a.get("family"))
        name = " ".join(p for p in (given, family) if p) or _clean(a.get("name"))
        if name:
            authors.append(Author(name=name, given=given, family=family))
    abstract = work.get("abstract")
    if abstract:
        abstract = _clean(re.sub(r"<[^>]+>", " ", abstract))  # JATS 태그 제거
    return _paper(
        source="crossref",
        method="identifier",
        title=title,
        authors=authors,
        year=year,
        venue=venue,
        abstract=abstract,
        kind=_crossref_kind(work, venue),
        ids=_ids(doi=work.get("DOI")),
    )


async def crossref_by_doi(client: httpx.AsyncClient, doi: str, keys: Keys) -> PaperMetadata | None:
    params = {"mailto": keys.crossref_mailto} if keys.crossref_mailto else None
    res = await _get(client, f"{CROSSREF_API}/{quote(doi, safe='/')}", params=params)
    return parse_crossref(_json(res)) if res else None


# --- OpenAlex ----------------------------------------------------------------------------


def _openalex_abstract(index: dict[str, list[int]] | None) -> str | None:
    if not index:
        return None
    words = sorted((pos, word) for word, positions in index.items() for pos in positions)
    return _clean(" ".join(w for _, w in words))


def _openalex_kind(work: dict[str, Any], source: dict[str, Any]) -> Any:
    kind, source_type = work.get("type"), source.get("type")
    if kind == "preprint" or source_type == "repository":
        return "preprint"
    if source_type == "conference" or kind == "conference-paper":
        name = (source.get("display_name") or "").lower()
        return "workshop" if "workshop" in name else "conference"
    if source_type == "journal" or kind == "article":
        return "journal"
    return "other"


def parse_openalex(work: dict[str, Any], method: Any) -> PaperMetadata | None:
    title = _clean(work.get("display_name") or work.get("title"))
    if not title:
        return None
    source = (work.get("primary_location") or {}).get("source") or {}
    ids = work.get("ids") or {}
    authors = [
        _split_name(name)
        for a in work.get("authorships") or []
        if (name := _clean((a.get("author") or {}).get("display_name")))
    ]
    openalex_id = (ids.get("openalex") or work.get("id") or "").rsplit("/", 1)[-1] or None
    return _paper(
        source="openalex",
        method=method,
        title=title,
        authors=authors,
        year=work.get("publication_year"),
        venue=_clean(source.get("display_name")) if source.get("type") != "repository" else None,
        abstract=_openalex_abstract(work.get("abstract_inverted_index")),
        kind=_openalex_kind(work, source),
        ids=_ids(doi=ids.get("doi") or work.get("doi"), openalex=openalex_id),
    )


def _openalex_params(keys: Keys, **params: Any) -> dict[str, Any]:
    return {**params, **({"api_key": keys.openalex} if keys.openalex else {})}


async def openalex_by_doi(client: httpx.AsyncClient, doi: str, keys: Keys) -> PaperMetadata | None:
    res = await _get(
        client, f"{OPENALEX_API}/doi:{quote(doi, safe='/')}", params=_openalex_params(keys)
    )
    return parse_openalex(_json(res), "identifier") if res else None


async def openalex_search(
    client: httpx.AsyncClient, title: str, keys: Keys, limit: int = 5
) -> list[PaperMetadata]:
    res = await _get(
        client, OPENALEX_API, params=_openalex_params(keys, search=title, **{"per-page": limit})
    )
    if not res:
        return []
    results = (_json(res) or {}).get("results") or []
    return [m for w in results if (m := parse_openalex(w, "title-search"))]


# --- Semantic Scholar --------------------------------------------------------------------


def _s2_kind(paper: dict[str, Any]) -> Any:
    types = paper.get("publicationTypes") or []
    venue = (paper.get("venue") or "").lower()
    if "Conference" in types:
        return "workshop" if "workshop" in venue else "conference"
    if "JournalArticle" in types:
        return "preprint" if venue in ("arxiv.org", "arxiv") else "journal"
    return "other"


def parse_s2(paper: dict[str, Any], method: Any) -> PaperMetadata | None:
    title = _clean(paper.get("title"))
    if not title:
        return None
    ext = paper.get("externalIds") or {}
    return _paper(
        source="s2",
        method=method,
        title=title,
        authors=[
            _split_name(n) for a in paper.get("authors") or [] if (n := _clean(a.get("name")))
        ],
        year=paper.get("year"),
        venue=_clean(paper.get("venue")),
        abstract=_clean(paper.get("abstract")),
        kind=_s2_kind(paper),
        ids=_ids(
            doi=ext.get("DOI"),
            arxiv=ext.get("ArXiv"),
            s2=paper.get("paperId"),
            dblp=ext.get("DBLP"),
        ),
    )


def _s2_headers(keys: Keys) -> dict[str, str]:
    return {"x-api-key": keys.s2} if keys.s2 else {}


async def s2_by_id(client: httpx.AsyncClient, paper_id: str, keys: Keys) -> PaperMetadata | None:
    """paper_id: 'DOI:<doi>' 또는 'ARXIV:<id>'."""
    res = await _get(
        client,
        f"{S2_API}/{quote(paper_id, safe=':/')}",
        params={"fields": S2_FIELDS},
        headers=_s2_headers(keys),
    )
    return parse_s2(_json(res), "identifier") if res else None


async def s2_title_match(client: httpx.AsyncClient, title: str, keys: Keys) -> list[PaperMetadata]:
    res = await _get(
        client,
        f"{S2_API}/search/match",
        params={"query": title, "fields": S2_FIELDS},
        headers=_s2_headers(keys),
    )
    if not res:
        return []
    return [m for p in (_json(res) or {}).get("data") or [] if (m := parse_s2(p, "title-search"))]
