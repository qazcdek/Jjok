"""venue 이름 정규화: 긴 학회·저널 이름을 짧은 표준 이름으로 바꾼다."""

import re

# (패턴, 표준 이름). 위에서부터 먼저 맞는 것을 쓴다. 워크숍 판별은 kind 쪽에서 한다.
_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(p, re.I), name)
    for p, name in [
        (r"neural information processing systems|\bneurips\b|\bnips\b", "NeurIPS"),
        (r"international conference on machine learning|\bicml\b", "ICML"),
        (r"international conference on learning representations|\biclr\b", "ICLR"),
        (r"computer vision and pattern recognition|\bcvpr\b", "CVPR"),
        (r"international conference on computer vision|\biccv\b", "ICCV"),
        (r"european conference on computer vision|\beccv\b", "ECCV"),
        (
            r"north american chapter of the association for computational linguistics|\bnaacl\b",
            "NAACL",
        ),
        (r"empirical methods in natural language processing|\bemnlp\b", "EMNLP"),
        (r"annual meeting of the association for computational linguistics|\bacl\b", "ACL"),
        (r"transactions of the association for computational linguistics|\btacl\b", "TACL"),
        (r"\baaai\b", "AAAI"),
        (r"\bijcai\b", "IJCAI"),
        (r"knowledge discovery and data mining|\bkdd\b", "KDD"),
        (r"transactions on machine learning research|\btmlr\b", "TMLR"),
        (r"journal of machine learning research|\bjmlr\b", "JMLR"),
        (r"\barxiv\b", "arXiv"),
    ]
]


def normalize_venue(raw: str | None) -> str | None:
    if not raw:
        return None
    for pattern, name in _RULES:
        if pattern.search(raw):
            return name
    return raw.strip() or None


def is_workshop(raw: str | None) -> bool:
    return bool(raw and re.search(r"\bworkshops?\b", raw, re.I))
