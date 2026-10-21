# 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, constr


class MetadataLookupInput(BaseModel):
    """
    내장 도구 metadata-lookup 입력: POST /v1/tools/metadata-lookup. DevDocs/05-agent-server.md §4.5. doi·arxiv·title 중 하나 이상 (서버가 검사)
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    doi: constr(min_length=1, max_length=300) | None = None
    arxiv: constr(min_length=1, max_length=40) | None = Field(
        None, description="버전 접미사 없이"
    )
    title: constr(min_length=1, max_length=500) | None = Field(
        None, description="식별자로 못 찾을 때 제목 검색에 쓴다"
    )
