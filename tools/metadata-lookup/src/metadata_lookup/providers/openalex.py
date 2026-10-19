"""OpenAlex. https://docs.openalex.org/

arXiv 판 레코드는 다른 판과 섞여 부정확한 경우가 있어(2026-10 확인), 제목 검색 보조로만 쓴다.
"""

import httpx

from ..models import Author, Ids, Kind, Metadata
from ..venue import is_workshop, normalize_venue
from .http import get

API = "https://api.openalex.org/works"
MAILTO = "qazcde.k@gmail.com"  # polite pool
SELECT = "id,doi,title,publication_year,type,authorships,primary_location,ids"


def _strip_doi(url: str | None) -> str | None:
    if not url:
        return None
    return url.removeprefix("https://doi.org/").lower()


def parse_work(w: dict) -> Metadata | None:
    title = w.get("title")
    if not title:
        return None
    src = (w.get("primary_location") or {}).get("source") or {}
    source_name = src.get("display_name")
    doi = _strip_doi(w.get("doi"))
    ids = Ids(openalex=(w.get("id") or "").removeprefix("https://openalex.org/") or None)
    # 판별 기준: 출처 종류(source.type: conference | journal | repository) → 작품 종류(type)
    kind: Kind = "other"
    if doi and doi.startswith("10.48550/arxiv."):
        ids.arxiv = doi.removeprefix("10.48550/arxiv.")
        kind = "preprint"
    else:
        ids.doi = doi
        source_type, work_type = src.get("type"), w.get("type")
        if source_type == "conference" or work_type == "conference-paper":
            kind = "workshop" if is_workshop(source_name) else "conference"
        elif source_type == "journal":
            kind = "journal"
        elif source_type == "repository" or work_type == "preprint":
            kind = "preprint"
    return Metadata(
        title=" ".join(title.split()),
        authors=[
            Author(name=a["author"]["display_name"])
            for a in w.get("authorships") or []
            if (a.get("author") or {}).get("display_name")
        ],
        year=w.get("publication_year"),
        venue=normalize_venue(source_name),
        kind=kind,
        ids=ids,
        source="openalex",
    )


def search_title(client: httpx.Client, title: str, limit: int = 5) -> list[Metadata]:
    res = get(
        client,
        "openalex",
        API,
        params={"search": title, "per_page": limit, "select": SELECT, "mailto": MAILTO},
    )
    if res is None:
        return []
    return [m for w in res.json().get("results") or [] if (m := parse_work(w))]
