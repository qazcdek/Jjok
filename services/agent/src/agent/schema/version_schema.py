# 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from . import common_schema


class Ids(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    doi: str | None = None
    arxiv: str | None = None
    arxivVersion: int | None = None
    openreview: str | None = None


class VersionDoc(BaseModel):
    """
    users/{uid}/works/{workId}/versions/{versionId}. DevDocs/03-data-model.md §3.3
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    schemaVersion: common_schema.SchemaVersion
    kind: Literal["preprint", "workshop", "conference", "journal", "other"]
    label: str
    ids: Ids
    venue: str | None = None
    year: int | None = None
    driveFileId: str | None = None
    fileHash: str | None = Field(None, description="SHA-256 hex")
    fileName: str | None = None
    fileSize: int | None = None
    format: Literal["pdf", "markdown"]
    pageCount: int | None = None
    metadataSource: Literal["identifier", "title-search", "manual", "agent"]
    createdAt: common_schema.Timestamp
    updatedAt: common_schema.Timestamp
