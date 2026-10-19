"""제목 정규화·유사도. apps/web 의 normalizeTitle 과 같은 규칙."""

import re
import unicodedata
from difflib import SequenceMatcher

_NON_WORD = re.compile(r"[^\w]+|_", re.UNICODE)


def normalize_title(title: str) -> str:
    t = unicodedata.normalize("NFKC", title).lower()
    return " ".join(_NON_WORD.sub(" ", t).split())


def title_similarity(a: str, b: str) -> float:
    na, nb = normalize_title(a), normalize_title(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def family_name(name: str) -> str:
    """'Kaiming He' → 'he', 'He, Kaiming' → 'he'"""
    name = name.strip()
    if "," in name:
        return name.split(",", 1)[0].strip().lower()
    parts = name.split()
    return parts[-1].lower() if parts else ""
