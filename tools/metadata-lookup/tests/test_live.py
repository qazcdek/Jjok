"""실제 API 호출. 기본 제외: uv run pytest -m live"""

import pytest

from metadata_lookup.core import run
from metadata_lookup.models import Input

pytestmark = pytest.mark.live


def test_live_arxiv():
    out = run(Input(arxiv="1706.03762"))
    assert out.metadata and out.metadata.title == "Attention Is All You Need"


def test_live_title():
    out = run(Input(title="Deep Residual Learning for Image Recognition", firstAuthor="He"))
    assert out.metadata and out.metadata.venue == "CVPR"
