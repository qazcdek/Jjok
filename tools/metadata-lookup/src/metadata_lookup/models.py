"""입출력 모델. 필드 이름은 packages/schema 의 Work/Version 과 맞춘다."""

from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

Kind = Literal["preprint", "workshop", "conference", "journal", "other"]


class Author(BaseModel):
    name: str
    family: str | None = None
    given: str | None = None


class Ids(BaseModel):
    doi: str | None = None
    arxiv: str | None = None
    arxivVersion: int | None = None
    openreview: str | None = None
    s2: str | None = None
    openalex: str | None = None
    dblp: str | None = None


class Metadata(BaseModel):
    title: str
    authors: list[Author] = Field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    kind: Kind = "other"
    abstract: str | None = None
    ids: Ids = Field(default_factory=Ids)
    source: str = Field(description="정보를 가져온 곳: arxiv | crossref | openalex | s2")


class Input(BaseModel):
    doi: str | None = None
    arxiv: str | None = Field(None, description="버전 접미사 없는 arXiv ID")
    title: str | None = Field(None, description="식별자가 없을 때 제목으로 검색")
    firstAuthor: str | None = Field(None, description="제목 검색 후보를 거르는 제1저자 성")
    year: int | None = None

    @model_validator(mode="after")
    def _need_one(self) -> Self:
        if not (self.doi or self.arxiv or (self.title and self.title.strip())):
            raise ValueError("doi, arxiv, title 중 하나는 있어야 합니다")
        return self


class Output(BaseModel):
    status: Literal["found", "ambiguous", "not_found"]
    metadata: Metadata | None = None
    candidates: list[Metadata] = Field(
        default_factory=list, description="ambiguous 일 때 사용자 확인용 후보 (M1-05)"
    )
    warnings: list[str] = Field(default_factory=list)
