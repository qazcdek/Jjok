"""조회 순서와 후보 선택 (ADR-0010 core). 형식(CLI) 은 모른다.

- DOI   → Crossref → (실패 시) S2
- arXiv → arXiv API → (키 있으면) S2 로 외부 ID 보강
- 제목  → (키 있으면) S2 match + OpenAlex + arXiv 검색 → 유사도로 고른다
"""

import os
from collections.abc import Callable

import httpx
from jjok_toolkit import ToolError

from .models import Ids, Input, Metadata, Output
from .providers import UpstreamError, arxiv, crossref, openalex, s2
from .providers.http import USER_AGENT
from .text import family_name, normalize_title, title_similarity

MATCH = 0.92  # 이 이상이면 같은 논문으로 본다 (평가셋으로 조정, DevDocs/08 §4.1)
MAYBE = 0.75  # 이 이상이면 사용자 확인 후보로 보여 준다


def _merge_ids(into: Ids, other: Ids) -> None:
    for field, value in other.model_dump().items():
        if value is not None and getattr(into, field) is None:
            setattr(into, field, value)


def _score(m: Metadata, inp: Input) -> float:
    score = title_similarity(m.title, inp.title or "")
    if (
        inp.firstAuthor
        and m.authors
        and family_name(m.authors[0].name) != family_name(inp.firstAuthor)
    ):
        score -= 0.1
    if inp.year and m.year and abs(m.year - inp.year) > 2:
        score -= 0.1
    return score


class Lookup:
    def __init__(self, client: httpx.Client) -> None:
        self.client = client
        self.warnings: list[str] = []
        self.has_s2_key = bool(os.environ.get("S2_API_KEY"))
        self.calls = 0
        self.failures = 0

    def _try[T](self, fn: Callable[..., T], *args: object) -> T | None:
        self.calls += 1
        try:
            return fn(self.client, *args)
        except UpstreamError as e:
            self.failures += 1
            self.warnings.append(str(e))
            return None

    def _enrich_from_s2(self, m: Metadata, paper_id: str) -> None:
        if not self.has_s2_key:
            return
        extra = self._try(s2.by_id, paper_id)
        if extra:
            _merge_ids(m.ids, extra.ids)

    def by_doi(self, doi: str) -> Metadata | None:
        m = self._try(crossref.by_doi, doi) or self._try(s2.by_id, f"DOI:{doi}")
        if m and m.source != "s2":
            self._enrich_from_s2(m, f"DOI:{doi}")
        return m

    def by_arxiv(self, arxiv_id: str) -> Metadata | None:
        m = self._try(arxiv.by_id, arxiv_id) or self._try(s2.by_id, f"arXiv:{arxiv_id}")
        if m and m.source != "s2":
            self._enrich_from_s2(m, f"arXiv:{arxiv_id}")
        return m

    def by_title(self, inp: Input) -> Output:
        title = inp.title or ""
        found: list[Metadata] = []
        if self.has_s2_key and (hit := self._try(s2.match_title, title)):
            found.append(hit)
        found += self._try(openalex.search_title, title) or []
        found += self._try(arxiv.search_title, title) or []

        scored = sorted(((_score(m, inp), m) for m in found), key=lambda x: x[0], reverse=True)
        good = [m for s, m in scored if s >= MATCH]
        if good:
            # 같은 제목의 판이 여럿이면 출판판(학회·저널)을 대표로, 나머지 판의 ID 를 합친다
            published = [m for m in good if m.kind != "preprint"]
            best = (published or good)[0].model_copy(deep=True)
            key = normalize_title(best.title)
            for m in good:
                if m is not best and normalize_title(m.title) == key:
                    _merge_ids(best.ids, m.ids)
            return Output(status="found", metadata=best, warnings=self.warnings)
        maybe = [m for s, m in scored if s >= MAYBE][:3]
        if maybe:
            return Output(status="ambiguous", candidates=maybe, warnings=self.warnings)
        return Output(status="not_found", warnings=self.warnings)

    def run(self, inp: Input) -> Output:
        m = None
        if inp.doi:
            m = self.by_doi(inp.doi.lower())
        if m is None and inp.arxiv:
            m = self.by_arxiv(inp.arxiv)
        if m is not None:
            return Output(status="found", metadata=m, warnings=self.warnings)
        title = (inp.title or "").strip()
        out = self.by_title(inp) if title else Output(status="not_found", warnings=self.warnings)
        # "없음" 과 "모든 소스가 실패해서 모름" 을 구분한다: 후자는 재시도할 수 있는 오류
        if out.status == "not_found" and self.calls and self.failures == self.calls:
            raise ToolError("upstream_error", "; ".join(self.warnings), retryable=True)
        return out


def run(inp: Input, client: httpx.Client | None = None) -> Output:
    if client is not None:
        return Lookup(client).run(inp)
    with httpx.Client(timeout=15, headers={"User-Agent": USER_AGENT}, follow_redirects=True) as c:
        return Lookup(c).run(inp)
