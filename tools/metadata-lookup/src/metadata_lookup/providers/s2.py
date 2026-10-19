"""Semantic Scholar Graph API. https://api.semanticscholar.org/api-docs/graph

키(S2_API_KEY)가 없으면 공용 한도에서 429 가 잦다. 실패해도 다른 소스로 넘어간다.
"""

import os

import httpx

from ..models import Author, Ids, Kind, Metadata
from ..venue import is_workshop, normalize_venue
from .http import get

API = "https://api.semanticscholar.org/graph/v1/paper/"
FIELDS = "title,authors,year,venue,publicationVenue,externalIds,abstract,publicationTypes"


def headers() -> dict[str, str]:
    key = os.environ.get("S2_API_KEY")
    return {"x-api-key": key} if key else {}


def parse_paper(p: dict) -> Metadata | None:
    if not p.get("title"):
        return None
    ext = p.get("externalIds") or {}
    venue_raw = (p.get("publicationVenue") or {}).get("name") or p.get("venue")
    types = p.get("publicationTypes") or []
    kind: Kind = "other"
    if "Conference" in types:
        kind = "workshop" if is_workshop(venue_raw) else "conference"
    elif "JournalArticle" in types:
        kind = "journal"
    venue = normalize_venue(venue_raw)
    if venue == "arXiv":
        kind = "preprint"
    return Metadata(
        title=" ".join(p["title"].split()),
        authors=[Author(name=a["name"]) for a in p.get("authors") or [] if a.get("name")],
        year=p.get("year"),
        venue=venue,
        kind=kind,
        abstract=p.get("abstract"),
        ids=Ids(
            s2=p.get("paperId"),
            doi=(ext.get("DOI") or "").lower() or None,
            arxiv=ext.get("ArXiv"),
            dblp=ext.get("DBLP"),
        ),
        source="s2",
    )


def by_id(client: httpx.Client, paper_id: str) -> Metadata | None:
    """paper_id: 'arXiv:1706.03762' | 'DOI:10.x/y' | S2 paperId"""
    res = get(client, "s2", API + paper_id, params={"fields": FIELDS}, headers=headers())
    return parse_paper(res.json()) if res is not None else None


def match_title(client: httpx.Client, title: str) -> Metadata | None:
    res = get(
        client,
        "s2",
        API + "search/match",
        params={"query": title, "fields": FIELDS},
        headers=headers(),
    )
    if res is None:
        return None
    data = res.json().get("data") or []
    return parse_paper(data[0]) if data else None
