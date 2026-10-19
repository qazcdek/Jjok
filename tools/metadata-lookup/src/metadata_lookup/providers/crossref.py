"""Crossref REST API. https://api.crossref.org/swagger-ui/index.html"""

from urllib.parse import quote

import httpx

from ..models import Author, Ids, Kind, Metadata
from ..venue import is_workshop, normalize_venue
from .http import get

API = "https://api.crossref.org/works/"

_KIND: dict[str, Kind] = {
    "proceedings-article": "conference",
    "journal-article": "journal",
    "posted-content": "preprint",
}


def parse_work(msg: dict) -> Metadata | None:
    titles = msg.get("title") or []
    if not titles:
        return None
    container = (msg.get("container-title") or [None])[0]
    event = (msg.get("event") or {}).get("name")
    venue_raw = container or event
    kind = _KIND.get(msg.get("type", ""), "other")
    if kind == "conference" and is_workshop(venue_raw):
        kind = "workshop"
    parts = (msg.get("issued") or msg.get("published") or {}).get("date-parts") or [[None]]
    year = parts[0][0] if parts and parts[0] else None
    authors = []
    for a in msg.get("author") or []:
        given, family = a.get("given"), a.get("family")
        name = " ".join(p for p in (given, family) if p) or a.get("name")
        if name:
            authors.append(Author(name=name, given=given, family=family))
    abstract = msg.get("abstract")
    return Metadata(
        title=" ".join(titles[0].split()),
        authors=authors,
        year=year,
        venue=normalize_venue(venue_raw),
        kind=kind,
        abstract=abstract,
        ids=Ids(doi=(msg.get("DOI") or "").lower() or None),
        source="crossref",
    )


def by_doi(client: httpx.Client, doi: str) -> Metadata | None:
    res = get(client, "crossref", API + quote(doi, safe="/"))
    if res is None:
        return None
    return parse_work(res.json().get("message") or {})
