"""실제 외부 API 로 확인하는 테스트. 기본 실행에서는 건너뛴다.

실행: JJOK_LIVE=1 uv run pytest -m live  (.env 의 OPENALEX_API_KEY·S2_API_KEY 를 쓴다)
"""

import os

import pytest

from jjok.http import new_client
from jjok.schema.metadata_lookup_input_schema import MetadataLookupInput
from jjok.settings import Settings
from jjok.tools.builtin.metadata_lookup.core import lookup
from jjok.tools.registry import _keys

BERT = "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding"

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("JJOK_LIVE"), reason="JJOK_LIVE 가 없음"),
]


@pytest.mark.parametrize(
    ("req", "title", "source"),
    [
        ({"arxiv": "1706.03762"}, "Attention Is All You Need", "arxiv"),
        (
            {"doi": "10.1109/CVPR.2016.90"},
            "Deep Residual Learning for Image Recognition",
            "crossref",
        ),
        ({"title": BERT}, BERT, "openalex"),
    ],
)
async def test_실제_API(req, title, source):
    async with new_client() as client:
        out = await lookup(MetadataLookupInput.model_validate(req), client, _keys(Settings()))
    assert out.status == "found" and out.match
    assert out.match.title.lower() == title.lower()
    assert out.match.source == source
