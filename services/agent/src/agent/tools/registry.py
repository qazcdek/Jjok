"""도구 레지스트리 (config/tools.toml)."""

import tomllib
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

CONFIG = Path(__file__).resolve().parents[3] / "config" / "tools.toml"
REPO_ROOT = Path(__file__).resolve().parents[5]


class ToolSpec(BaseModel):
    name: str
    transport: Literal["cli", "mcp-stdio"] = "cli"
    command: str | list[str]
    project: str | None = None
    timeout_s: float = 30
    exposed: bool = False
    agent: bool = False
    description: str = ""
    env: list[str] = Field(default_factory=list)


def load_registry(path: Path = CONFIG) -> dict[str, ToolSpec]:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    return {name: ToolSpec(name=name, **spec) for name, spec in (data.get("tools") or {}).items()}


@lru_cache
def get_registry() -> dict[str, ToolSpec]:
    return load_registry()
