# ADR-0010: 에이전트 도구 형태 선택 기준 (내장 · CLI · MCP)

- 상태: accepted (2026-10-19 승인)
- 날짜: 2026-10-19
- 근거: ADR-0005 보완, DEV-005 §4, 예산(DEV-007 §8)

## 배경

ADR-0005는 uv tool CLI를 기본으로 하고 MCP는 대안으로 남겼다. 도구를 만들기 시작하기 전에(M0 저장소 골격, M5 첫 도구) 어떤 도구를 CLI로, 어떤 도구를 MCP 서버로 만들지 기준이 필요하다.

전제: **둘 다 uv 패키지로 배포한다.** 차이는 패키징이 아니라 프로세스 수명이다.

| 형태 | 수명 | 호출 |
| --- | --- | --- |
| CLI (uv tool) | 호출마다 실행 → 종료 | stdin JSON → stdout JSON (DEV-005 §4.2) |
| MCP 서버 | 백엔드 서버와 함께 떠서 계속 살아 있음 | MCP 프로토콜 (stdio), `langchain-mcp-adapters`로 LangGraph에 바인딩 |

여기에 세 번째 선택지가 있다: 외부 패키지로 빼지 않고 **백엔드 서버 안의 Python 함수(내장 도구)**로 두는 것.

## 결정

### 1. 판단 순서

```
Q1. 서버의 신뢰된 문맥이 필요한가?
    (사용자 uid로 범위를 좁힌 Firestore 읽기/쓰기, 결과 저장, KMS, 요청별 상태)
    └─ 예 → 내장 도구
Q2. 호출 사이에 유지해야 할 것이 있는가?  (MCP 조건 M1~M4 중 하나라도 해당)
    └─ 예 → MCP 서버
Q3. 그 외 → CLI (기본값)
```

### 2. 형태별 기준

**내장 도구** (`services/api/src/jjok/tools/builtin/`)
- 사용자 데이터를 읽거나 쓴다. 예: 라이브러리 조회, AI 노트 저장, 하이라이트 제안·링크 기록.
- 다른 곳에서 재사용할 일이 없다.
- 이유: uid·권한을 외부 프로세스에 넘기면 신뢰 경계가 늘어난다. 내장 도구는 서버가 검증한 uid를 그대로 쓴다.

**MCP 서버** — 아래 중 하나 이상
- **M1 웜 리소스**: 띄우는 데 1초 이상 걸리는 무거운 것(모델, 큰 인덱스, 브라우저 등)을 메모리에 올려 두어야 하고, 에이전트 실행 한 번에 여러 번 호출된다.
- **M2 호출 간 상태**: 세션·커서·캐시·연결 풀을 호출 사이에 유지해야 한다.
- **M3 도구 묶음**: 같은 문맥을 공유하는 관련 기능 3개 이상을 한 단위로 제공하거나, MCP의 resources·prompts가 필요하다.
- **M4 긴 작업**: 30초를 넘기는 작업이라 진행 알림과 취소가 필요하다.
- **M5 (보조)**: 개발 중에 Claude Code 같은 외부 MCP 클라이언트에서도 쓰면 이득이 크다. 단독으로는 MCP 전환 사유가 되지 않는다. CLI 도구도 필요하면 MCP 어댑터를 덧붙여 노출할 수 있다 (아래 3).

**CLI (기본값)**
- 상태 없는 요청 → 응답: 외부 API 검색, 메타데이터 조회, 결정적 계산(매칭, 파싱).
- 에이전트 밖에서도 쓴다: `/v1/tools` 직접 호출, citation-refresh job, 평가 스크립트, 터미널 디버깅.
- 이유: 단독 실행·골든 테스트가 쉽고, 도구가 죽어도 다음 호출에 영향이 없다.

### 3. 공통 구조: 로직은 하나, 어댑터는 얇게

형태를 나중에 바꿔도 로직을 다시 쓰지 않도록, 모든 외부 도구는 같은 구조를 따른다.

```
tools/<name>/
  pyproject.toml            [project.scripts] <name> = "<pkg>.cli:main"
                            (MCP면) <name>-mcp = "<pkg>.mcp:main"
  src/<pkg>/
    core.py                 순수 로직. 입력·출력은 Pydantic 모델
    cli.py                  stdin/stdout JSON 어댑터 (DEV-005 §4.2)
    mcp.py                  (선택) FastMCP 어댑터 — core 함수를 그대로 노출
  tests/
```

- 입력·출력 스키마는 core의 Pydantic 모델 하나에서 나온다 (`--schema`도, MCP 도구 스키마도).
- CLI → MCP 전환은 `mcp.py`를 추가하고 레지스트리 `transport`만 바꾸는 일이어야 한다.

### 4. 제약 (v1)

- **MCP는 stdio로, 백엔드 서버 컨테이너 안에서만** 띄운다. 별도 Cloud Run 서비스로 배포하는 원격 MCP 서버는 만들지 않는다 (예산 월 2만 원, 인증 경계 추가).
- **외부(제3자) MCP 서버는 운영 경로에 쓰지 않는다.** 개발 편의용(로컬 Claude Code 등)은 허용. 운영에 넣으려면 서비스 제공자가 직접 관리하는지, 버전 고정, 코드 검토를 모두 만족해야 하고 별도 ADR을 쓴다.
- 어떤 형태든 **사용자 LLM API 키를 받지 않는다** (ADR-0008). 외부 API 키(S2 등)는 환경변수로만.
- MCP 도구가 LLM을 직접 부르는 기능(sampling)은 쓰지 않는다. LLM 호출은 LangGraph 쪽에서만 한다.

### 5. 레지스트리 표기

`services/api/config/tools.toml`에 `transport`를 둔다.

```toml
[tools.arxiv-search]
transport = "cli"            # cli | mcp-stdio
command = "arxiv-search"

[tools.library-index]
transport = "mcp-stdio"
command = "library-index-mcp"
startup_timeout_s = 20
```

내장 도구는 레지스트리에 넣지 않고 코드에서 등록한다.

## 초기 도구 분류

| 도구 | 형태 | 근거 |
| --- | --- | --- |
| `arxiv-search`, `openreview-search`, `dblp-venue-search` | CLI | 상태 없는 외부 API 검색, `/v1/tools`로 직접 호출 |
| `s2-citations` | CLI | 상태 없음, citation-refresh job에서 배치로 실행 |
| `pdf-extract` | CLI | 상태 없는 파싱, 호출 빈도 낮음 |
| `version-match` | CLI | 결정적 계산, 평가 스크립트에서 단독 실행 |
| `note-search` | **미정 (M6)** | 서버 쪽 인덱스를 메모리에 유지해야 하면 M1·M2 → MCP. 브라우저 인덱스 결과만 넘겨받으면 내장 도구 |
| 라이브러리 조회, AI 노트 저장, 제안 기록 | 내장 | Q1: uid 범위 Firestore 접근 |

## 결과

- v1 초기 도구는 대부분 CLI라 M5 일정에 영향이 없다.
- 도구 구조(core/cli/mcp)가 정해져 M0 저장소 골격(M0-T1)에서 `tools/_template/`을 만들 수 있다.
- MCP를 쓰는 도구가 생기면 백엔드 서버 시작 시간이 늘어난다. Cloud Run `min-instances=0`에서는 콜드 스타트가 길어지므로, MCP 도구는 처음 필요할 때 띄우는 방식(lazy start)을 검토한다.
