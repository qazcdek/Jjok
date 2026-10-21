"""조회 순서 (DevDocs/05-agent-server.md §4.5).

1. arXiv ID → arXiv API. (OpenAlex 는 arXiv 논문의 연도·DOI 가 틀린 경우가 있어 쓰지 않는다)
2. DOI → Crossref → OpenAlex → S2. arXiv DOI(10.48550)는 1번으로 보낸다.
3. 식별자로 못 찾으면 제목 → OpenAlex 검색 → S2 제목 매칭. 유사도 ≥ TITLE_MATCH 면 found.

한 곳이 실패해도 다음 곳으로 넘어간다. 아무것도 못 찾았고 실패만 있었으면 UpstreamError.
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Literal, TypeVar

import httpx

from ....schema.metadata_lookup_input_schema import MetadataLookupInput
from ....schema.metadata_lookup_output_schema import (
    MetadataLookupOutput,
    PaperMetadata,
    TriedItem,
)
from . import providers as p
from .titles import title_similarity

log = logging.getLogger(__name__)

# 제목 검색 결과를 그대로 받아들이는 유사도. M1-12 평가셋으로 조정한다
TITLE_MATCH = 0.9
Source = Literal["arxiv", "crossref", "openalex", "s2"]
T = TypeVar("T")


class LookupFailed(p.UpstreamError):
    """모든 조회가 실패했다. rate_limited 면 429 로 응답한다."""

    def __init__(self, rate_limited: bool):
        super().__init__("메타데이터 조회 실패")
        self.rate_limited = rate_limited


async def lookup(
    req: MetadataLookupInput, client: httpx.AsyncClient, keys: p.Keys
) -> MetadataLookupOutput:
    tried: list[TriedItem] = []

    async def attempt(source: Source, call: Callable[[], Awaitable[T]]) -> T | None:
        try:
            result = await call()
        except p.RateLimited:
            tried.append(TriedItem(source=source, outcome="rate_limited"))
            return None
        except p.UpstreamError as e:
            log.warning("metadata-lookup %s 실패: %s", source, e)
            tried.append(TriedItem(source=source, outcome="error"))
            return None
        tried.append(TriedItem(source=source, outcome="found" if result else "not_found"))
        return result

    doi = req.doi.strip().lower() if req.doi else None
    arxiv = req.arxiv.strip() if req.arxiv else None
    if doi and (from_doi := p.arxiv_id_from_doi(doi)):
        arxiv, doi = arxiv or from_doi, None

    match: PaperMetadata | None = None
    if arxiv:
        match = await attempt("arxiv", lambda: p.arxiv_by_id(client, arxiv))
    if not match and doi:
        match = (
            await attempt("crossref", lambda: p.crossref_by_doi(client, doi, keys))
            or await attempt("openalex", lambda: p.openalex_by_doi(client, doi, keys))
            or await attempt("s2", lambda: p.s2_by_id(client, f"DOI:{doi}", keys))
        )
    if match:
        return MetadataLookupOutput(status="found", match=match, candidates=[], tried=tried)

    candidates: list[PaperMetadata] = []
    if req.title and req.title.strip():
        title = req.title.strip()
        found = await attempt("openalex", lambda: p.openalex_search(client, title, keys))
        if not found:
            found = await attempt("s2", lambda: p.s2_title_match(client, title, keys))
        candidates = sorted(
            (
                c.model_copy(update={"score": round(title_similarity(title, c.title), 3)})
                for c in found or []
            ),
            key=lambda c: c.score or 0,
            reverse=True,
        )

    if candidates and (candidates[0].score or 0) >= TITLE_MATCH:
        return MetadataLookupOutput(
            status="found", match=candidates[0], candidates=candidates[1:], tried=tried
        )
    if candidates:
        return MetadataLookupOutput(status="ambiguous", candidates=candidates, tried=tried)
    if tried and all(t.outcome in ("error", "rate_limited") for t in tried):
        raise LookupFailed(rate_limited=any(t.outcome == "rate_limited" for t in tried))
    return MetadataLookupOutput(status="not_found", candidates=[], tried=tried)
