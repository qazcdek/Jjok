# 도구 템플릿

새 에이전트 도구는 이 폴더를 복사해서 시작한다. 형태 선택 기준은 [ADR-0010](../../DevDocs/adr/0010-tool-form-criteria.md), 호출 계약은 [DEV-005 §4](../../DevDocs/05-agent-server.md).

```
src/<pkg>/core.py   로직 + 입출력 모델 (형식 독립)
src/<pkg>/cli.py    jjok_toolkit.run_cli 로 stdin/stdout 계약 연결
src/<pkg>/mcp.py    (선택) MCP 가 필요할 때만 추가
tests/              계약 테스트: 성공·실패 형식, --schema, stdout 오염 없음
```

```bash
uv run --project tools/_template pytest            # 테스트
echo '{"text":"hi","repeat":2}' | uv run --project tools/_template tool-template
uv tool install --editable ./tools/<name>          # 서버가 쓰도록 설치
```
