"""모듈 경계 검사 (ADR-0012).

api/ 와 공용 모듈은 agent/ 나 무거운 LLM 의존성을 import 하지 않는다.
그래야 M6 에서 api 서비스만 따로 띄울 때 기동이 가볍고, KMS 권한이 필요한 코드가 섞이지 않는다.
조립 진입점(main.py)은 예외다.
"""

import ast
from pathlib import Path

import pytest

PKG = Path(__file__).parents[1] / "src" / "jjok"
ENTRYPOINTS = {"main.py"}
HEAVY = ("langgraph", "langchain", "langchain_core", "openai", "anthropic", "google.genai")


def _checked_files() -> list[Path]:
    files = []
    for f in PKG.rglob("*.py"):
        rel = f.relative_to(PKG)
        if rel.parts[0] in ("agent", "schema") or rel.as_posix() in ENTRYPOINTS:
            continue
        files.append(f)
    return files


def _imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    depth = len(path.relative_to(PKG).parts) - 1
    names = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                # 상대 import 를 jjok.* 절대 이름으로 바꾼다
                base = list(path.relative_to(PKG).parts[:depth])
                base = base[: len(base) - (node.level - 1)] if node.level > 1 else base
                mod = ".".join(["jjok", *base, *([node.module] if node.module else [])])
                names += [mod] + [f"{mod}.{a.name}" for a in node.names]
            elif node.module:
                names.append(node.module)
    return names


def _forbidden(name: str) -> bool:
    if name == "jjok.agent" or name.startswith("jjok.agent."):
        return True
    return any(name == h or name.startswith(h + ".") for h in HEAVY)


@pytest.mark.parametrize("path", _checked_files(), ids=lambda p: str(p.relative_to(PKG)))
def test_api_와_공용_모듈은_agent_를_import_하지_않는다(path: Path):
    bad = [n for n in _imports(path) if _forbidden(n)]
    assert not bad, f"{path.relative_to(PKG)}: {bad}"


def test_검사기는_금지된_import_를_잡는다(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    fake = tmp_path / "jjok"
    (fake / "api").mkdir(parents=True)
    f = fake / "api" / "bad.py"
    f.write_text("from ..agent import graphs\nimport langgraph.graph\n", encoding="utf-8")
    monkeypatch.setattr(__import__(__name__), "PKG", fake)
    bad = [n for n in _imports(f) if _forbidden(n)]
    assert "jjok.agent" in bad
    assert "langgraph.graph" in bad
