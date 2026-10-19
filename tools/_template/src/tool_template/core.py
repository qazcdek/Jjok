"""도구 로직. 입출력은 Pydantic 모델, 외부 I/O 형식(CLI/MCP)은 모른다 (ADR-0010 §3)."""

from jjok_toolkit import ToolError
from pydantic import BaseModel, Field


class Input(BaseModel):
    text: str = Field(description="반복할 텍스트")
    repeat: int = Field(1, ge=1, le=10, description="반복 횟수")


class Output(BaseModel):
    text: str


def run(inp: Input) -> Output:
    if not inp.text.strip():
        raise ToolError("empty_text", "text 가 비어 있습니다.")
    return Output(text=" ".join([inp.text] * inp.repeat))
