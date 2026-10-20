# 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from . import common_schema


class LlmDefault(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    provider: Literal["gemini", "openai", "anthropic", "llama"]
    model: str


class Settings(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    theme: Literal["light", "dark", "system"]
    citationStyle: Literal["apa", "ieee", "acm", "chicago", "bibtex"]
    venueFilter: list[str]
    llmDefault: LlmDefault | None = None


class Drive(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    rootFolderId: str | None = Field(None, description="/Jjok 폴더 ID")
    filesFolderId: str | None = Field(None, description="/Jjok/files 폴더 ID")


class UserDoc(BaseModel):
    """
    users/{uid}. DevDocs/03-data-model.md §3.1
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    schemaVersion: common_schema.SchemaVersion
    displayName: str
    email: str
    photoURL: str | None = None
    settings: Settings
    drive: Drive | None = None
    createdAt: common_schema.Timestamp
    updatedAt: common_schema.Timestamp
