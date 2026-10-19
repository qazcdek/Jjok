# 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen

from __future__ import annotations

from typing import Any

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, RootModel, conint


class Common(RootModel[Any]):
    root: Any = Field(
        ..., description="공통 정의. DevDocs/03-data-model.md §1", title="Common"
    )


class Timestamp(RootModel[AwareDatetime]):
    root: AwareDatetime = Field(
        ...,
        description="Firestore Timestamp (TS: firebase Timestamp, Python: datetime)",
    )


class SchemaVersion(RootModel[conint(ge=1)]):
    root: conint(ge=1)


class ExternalIds(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    doi: str | None = None
    arxiv: str | None = Field(None, description="버전 접미사 제거 (예: 2401.01234)")
    openreview: str | None = None
    s2: str | None = None
    openalex: str | None = None
    dblp: str | None = None
