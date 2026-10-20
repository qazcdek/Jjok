"""제목 정규화·유사도.

웹 앱 normalizeTitle 과 같은 규칙 (apps/web/src/features/library/uploads.ts).
"""

import re
import unicodedata
from difflib import SequenceMatcher

_NON_WORD = re.compile(r"[^\w]+|_+")


def normalize_title(title: str) -> str:
    """소문자, NFKC, 글자·숫자 외 기호를 공백으로, 공백 정리."""
    return " ".join(_NON_WORD.sub(" ", unicodedata.normalize("NFKC", title).lower()).split())


def title_similarity(a: str, b: str) -> float:
    """정규화 제목의 유사도 (0~1)."""
    na, nb = normalize_title(a), normalize_title(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()
