"""도구 레지스트리. M1 은 내장 도구만 코드로 등록한다 (CLI·MCP 는 M5 에서 config/tools.toml)."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import BaseModel

from ..schema.metadata_lookup_input_schema import MetadataLookupInput
from ..settings import Settings
from .builtin import metadata_lookup
from .builtin.metadata_lookup.providers import Keys


class ToolInputError(ValueError):
    """스키마는 맞지만 도구가 받을 수 없는 입력 (400 invalid_request)."""


@dataclass(frozen=True)
class ToolContext:
    uid: str
    client: httpx.AsyncClient
    settings: Settings


@dataclass(frozen=True)
class BuiltinTool:
    name: str
    input_model: type[BaseModel]
    run: Callable[[Any, ToolContext], Awaitable[BaseModel]]
    timeout_s: float = 30
    exposed: bool = False  # /v1/tools 로 직접 호출 허용
    description: str = ""


def _keys(settings: Settings) -> Keys:
    secret = lambda s: s.get_secret_value() if s else None  # noqa: E731
    return Keys(
        openalex=secret(settings.openalex_api_key),
        s2=secret(settings.s2_api_key),
        crossref_mailto=settings.crossref_mailto,
    )


async def _metadata_lookup(req: MetadataLookupInput, ctx: ToolContext) -> BaseModel:
    if not any(v and v.strip() for v in (req.doi, req.arxiv, req.title)):
        raise ToolInputError("doi, arxiv, title 중 하나는 있어야 합니다.")
    return await metadata_lookup.lookup(req, ctx.client, _keys(ctx.settings))


TOOLS: dict[str, BuiltinTool] = {
    t.name: t
    for t in [
        BuiltinTool(
            name="metadata-lookup",
            input_model=MetadataLookupInput,
            run=_metadata_lookup,
            timeout_s=30,
            exposed=True,
            description="DOI·arXiv ID·제목으로 논문 메타데이터를 찾는다.",
        ),
    ]
}
