# ADR-0012: 백엔드 서버 하나, api·agent 모듈 경계, M6에서 배포 분리

- 상태: accepted
- 날짜: 2026-10-20
- 근거: DEV-002 §1·§3.2·§4, DEV-005 §0, DEV-004 §4, F-1.2, F-7.7

## 배경

- M1 메타데이터 조회는 원래 브라우저에서 공개 API를 직접 부르고 M5에 서버로 옮길 계획이었다 (M5-T8).
- 2026-10-20 확인 결과 브라우저 직접 호출이 어렵다.
  - arXiv API(`export.arxiv.org`)는 `Access-Control-Allow-Origin`을 주지 않는다.
  - Semantic Scholar는 키 없이 부르면 공용 한도를 같이 써서 429가 잦다. 키는 브라우저에 둘 수 없다.
  - OpenAlex는 키 없이 쓰면 하루 한도가 무료 키의 1/10이다.
- 그래서 M1부터 서버를 거치기로 했다. 이때 LangGraph를 돌릴 "에이전트 서버"와 일반 API용 "백엔드 서버"를 나눌지 검토했다.

## 결정

1. **서버 코드베이스는 하나**로 둔다: `services/api` (uv 프로젝트, Python 패키지 `jjok`).
2. 안에서 모듈 경계를 나눈다.
   - `jjok.api`: 가벼운 동기 API (메타데이터 조회, `/v1/tools/*`, 인용 수집)
   - `jjok.tools`: 내장 도구와 도구 레지스트리. api·agent 공용
   - `jjok.agent`: LangGraph, LLM 라우팅, BYOK 키 (M6~)
   - `jjok.agent` 밖에서는 `jjok.agent`와 langgraph·LLM SDK를 import하지 않는다. `tests/test_module_boundary.py`로 강제한다. 조립 진입점 `main.py`만 예외다.
3. **배포는 M6 전까지 Cloud Run 서비스 1개**로 둔다. M6(KMS·BYOK 도입)에서 같은 이미지에 진입점만 다르게 해서 `jjok-api`·`jjok-agent` 두 서비스로 나눈다. KMS 복호화 권한은 `jjok-agent` 서비스 계정에만 준다.
4. 메타데이터 조회는 ADR-0010의 **내장 도구** `metadata-lookup`으로 만든다. M5의 CLI·MCP 도구 레지스트리와 같은 `/v1/tools/{tool}` 경로로 노출한다.

## 검토한 대안

- **지금부터 서비스 2개로 분리**: 권한 분리와 부하 격리는 좋지만, M1~M5 동안 agent 쪽 코드가 없어 배포·CI·서비스 계정·CORS 설정만 두 벌이 된다. 1인 개발에서 이득이 없다.
- **계속 하나로 두기**: 운영은 단순하다. 하지만 M6부터 LLM SSE 요청(수십 초~수 분)이 `max-instances=2`를 잡고 있으면 업로드 때 메타데이터 조회가 밀린다. 메타데이터 API 쪽에 취약점이 생기면 KMS 복호화 권한까지 닿는다.

## 결과

- 비용 차이는 거의 없다. 둘 다 `min-instances=0`이라 대기 비용이 없고, 분리 후에는 콜드 스타트가 서비스마다 생긴다.
- 기존 M5-T8(메타데이터 조회 서버 이전)은 없어지고, M1-T4 견적이 늘어난다.
- `services/agent` → `services/api`, 패키지 `agent` → `jjok`, `pnpm dev:agent` → `pnpm dev:api`, CI `ci-agent` → `ci-api`, `VITE_AGENT_BASE_URL` → `VITE_API_BASE_URL`.
- 외부 API 키(`S2_API_KEY`, `OPENALEX_API_KEY`)는 서버 환경변수에만 둔다.
