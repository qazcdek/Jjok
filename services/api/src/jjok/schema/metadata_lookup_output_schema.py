# 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, confloat

from . import common_schema


class TriedItem(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    source: Literal["arxiv", "crossref", "openalex", "s2"]
    outcome: Literal["found", "not_found", "rate_limited", "error"]


class Author(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    family: str | None = None
    given: str | None = None


class PaperMetadata(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    source: Literal["arxiv", "crossref", "openalex", "s2"]
    method: Literal["identifier", "title-search"]
    title: str
    authors: list[Author]
    year: int | None = None
    venue: str | None = Field(None, description="학회·저널 이름 (출처 표기 그대로)")
    abstract: str | None = None
    kind: Literal["preprint", "workshop", "conference", "journal", "other"] = Field(
        ..., description="이 메타데이터가 가리키는 버전의 종류"
    )
    ids: common_schema.ExternalIds
    arxivVersion: int | None = Field(None, description="arXiv 최신 버전 번호")
    score: confloat(ge=0.0, le=1.0) | None = Field(
        None, description="제목 검색일 때 입력 제목과의 유사도"
    )


class MetadataLookupOutput(BaseModel):
    """
    내장 도구 metadata-lookup 출력. DevDocs/05-agent-server.md §4.5
    """

    model_config = ConfigDict(
        extra="forbid",
    )
    status: Literal["found", "ambiguous", "not_found"] = Field(
        ...,
        description="found: match 를 그대로 써도 된다. ambiguous: 제목 검색 후보만 있다 (사용자 확인, M1-05). not_found: 후보 없음",
    )
    match: PaperMetadata | None = None
    candidates: list[PaperMetadata] = Field(
        ..., description="제목 검색 후보 (점수 순). found 일 때도 다른 후보를 함께 준다"
    )
    tried: list[TriedItem] = Field(
        ..., description="조회한 곳과 결과. 오류 원인 표시·디버깅용"
    )
