# 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import common_schema


class Author(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    family: str | None = None
    given: str | None = None
    s2AuthorId: str | None = None


class WorkDoc(BaseModel):
    """
    users/{uid}/works/{workId}. DevDocs/03-data-model.md §3.2
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    schemaVersion: common_schema.SchemaVersion
    title: str
    normTitle: str
    authors: list[Author]
    year: int | None = None
    venue: str | None = None
    primaryVersionId: str
    ids: common_schema.ExternalIds
    citeKey: str
    collectionIds: list[str]
    tagIds: list[str]
    abstract: str | None = None
    needsReview: bool | None = Field(
        None, description="자동 조회가 불확실해 사용자 확인이 필요 (M1-05)"
    )
    createdAt: common_schema.Timestamp
    updatedAt: common_schema.Timestamp
