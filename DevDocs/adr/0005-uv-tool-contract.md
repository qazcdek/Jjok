# ADR-0005: 에이전트 도구: uv tool + stdin/stdout JSON 계약

- 상태: accepted
- 날짜: 2026-10-19
- 근거: 기능 명세 'LangGraph + uv tool'

## 배경

에이전트 도구를 uv tool로 만들기로 했다. 서브프로세스 JSON 계약과 MCP 서버 두 가지 방식이 후보였다.

## 결정

v1은 stdin JSON → stdout JSON, `--schema`로 입력 스키마 출력 (DEV-005 §4). 레지스트리(`tools.toml`)에서 LangChain StructuredTool로 감싼다.

## 결과

- 도구를 CLI로 단독 테스트하기 쉽다. 도구마다 의존성이 격리된다.
- 호출마다 프로세스를 띄우는 비용이 있다 (수십~수백 ms). 검색·매칭 용도에는 충분하다.
- 나중에 MCP로 옮기려면 같은 스키마를 MCP 도구로 노출하는 얇은 래퍼만 추가하면 된다.
