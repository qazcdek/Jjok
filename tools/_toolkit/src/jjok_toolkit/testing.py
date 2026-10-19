"""도구 계약 테스트 도우미. 실제 서브프로세스로 실행해 서버가 부르는 방식과 같게 검사한다."""

import json
import subprocess
from dataclasses import dataclass


@dataclass
class ToolRun:
    exit_code: int
    stdout_lines: list[str]
    stderr: str

    @property
    def envelope(self) -> dict:
        assert len(self.stdout_lines) == 1, f"stdout 은 JSON 한 줄이어야 함: {self.stdout_lines!r}"
        return json.loads(self.stdout_lines[0])


def run_tool(command: list[str], payload: object | None = None, timeout: float = 30) -> ToolRun:
    stdin = "" if payload is None else json.dumps(payload, ensure_ascii=False)
    proc = subprocess.run(
        command, input=stdin, capture_output=True, text=True, timeout=timeout, check=False
    )
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    return ToolRun(proc.returncode, lines, proc.stderr)
