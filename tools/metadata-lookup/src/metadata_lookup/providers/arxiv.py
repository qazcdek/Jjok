"""arXiv API (Atom). https://info.arxiv.org/help/api/"""

import re
import xml.etree.ElementTree as ET

import httpx

from ..models import Author, Ids, Metadata
from .http import get

API = "https://export.arxiv.org/api/query"
NS = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
_ID_RE = re.compile(r"arxiv\.org/abs/(.+?)(?:v(\d+))?$")


def _text(el: ET.Element | None) -> str | None:
    if el is None or el.text is None:
        return None
    return " ".join(el.text.split()) or None


def _split_name(name: str) -> Author:
    parts = name.split()
    if len(parts) >= 2:
        return Author(name=name, given=" ".join(parts[:-1]), family=parts[-1])
    return Author(name=name)


def parse_feed(xml: str) -> list[Metadata]:
    root = ET.fromstring(xml)
    out: list[Metadata] = []
    for entry in root.findall("a:entry", NS):
        entry_id = _text(entry.find("a:id", NS)) or ""
        m = _ID_RE.search(entry_id)
        title = _text(entry.find("a:title", NS))
        if not m or not title:
            continue  # 오류 응답도 entry 하나로 온다
        published = _text(entry.find("a:published", NS)) or ""
        doi = _text(entry.find("arxiv:doi", NS))
        out.append(
            Metadata(
                title=title,
                authors=[
                    _split_name(n)
                    for a in entry.findall("a:author", NS)
                    if (n := _text(a.find("a:name", NS)))
                ],
                year=int(published[:4]) if published[:4].isdigit() else None,
                kind="preprint",
                abstract=_text(entry.find("a:summary", NS)),
                ids=Ids(
                    arxiv=m.group(1),
                    arxivVersion=int(m.group(2)) if m.group(2) else None,
                    doi=doi.lower() if doi else None,
                ),
                venue="arXiv",
                source="arxiv",
            )
        )
    return out


def by_id(client: httpx.Client, arxiv_id: str) -> Metadata | None:
    res = get(client, "arxiv", API, params={"id_list": arxiv_id, "max_results": 1})
    if res is None:
        return None
    entries = parse_feed(res.text)
    return entries[0] if entries else None


def search_title(client: httpx.Client, title: str, limit: int = 5) -> list[Metadata]:
    # 따옴표·콜론은 arXiv 검색 문법과 부딪히므로 뺀다
    q = re.sub(r'["():]', " ", title)
    res = get(
        client,
        "arxiv",
        API,
        params={"search_query": f'ti:"{" ".join(q.split())}"', "max_results": limit},
    )
    return parse_feed(res.text) if res is not None else []
