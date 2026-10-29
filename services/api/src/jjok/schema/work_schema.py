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
    fileHashes: list[str] | None = Field(
        None,
        description="모든 버전 PDF 의 SHA-256. 업로드 전 중복 검사용 (array-contains 쿼리, F-2.3)",
    )
    needsReview: bool | None = Field(
        None,
        description="메타데이터를 자동으로 확정하지 못해 사용자 확인이 필요하다 (M1-T5). 업로드 때 true, 조회로 찾거나 사용자가 확정하면 false",
    )
    createdAt: common_schema.Timestamp
    updatedAt: common_schema.Timestamp
