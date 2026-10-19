---
doc_id: DEV-005
title: 에이전트 서버 · LLM 라우팅 · uv tool 계약
version: 0.2.0
status: draft
updated: 2026-10-19
sources:
  - UserDocs/기능 명세.md (v0.1) — 7. AI 기능, LangGraph + uv tool
  - UserDocs/v1 개발 계획.md — M5, M6
---

# 에이전트 서버

FastAPI + LangGraph, Python 단일 스택. 패키지 관리는 uv. 위치: `services/agent/`.

## 1. API

모든 엔드포인트는 `Authorization: Bearer <Firebase ID 토큰>` 필요 (`/healthz` 제외). 경로 접두사 `/v1`.

### 1.1 공통 오류 형식

```json
{ "error": { "code": "provider_key_missing", "message": "OpenAI API 키가 등록되지 않았습니다.", "details": {} } }
```

| HTTP | code 예 |
| --- | --- |
| 400 | `invalid_request`, `provider_not_allowed` (prod에서 llama 요청) |
| 401 | `unauthenticated` |
| 404 | `not_found` |
| 409 | `provider_key_missing` |
| 429 | `rate_limited` (사용자 속도 제한), `upstream_rate_limited` (외부 API) |
| 502 | `upstream_error` (LLM·외부 API 실패) |

### 1.2 엔드포인트

| 메서드 · 경로 | 용도 | 요구사항 |
| --- | --- | --- |
| `GET /healthz` | 헬스 체크 | — |
| `GET /v1/models` | 사용 가능한 provider·모델 목록. dev에서만 `llama` 포함. 사용자 키 등록 여부 표시 | F-7.6 |
| `GET /v1/keys` | `{provider, last4, updatedAt}[]` | F-7.7 |
| `PUT /v1/keys/{provider}` | 키 등록·교체 `{apiKey}` → `{provider, last4}` | F-7.7 |
| `DELETE /v1/keys/{provider}` | 키 삭제 | F-7.7 |
| `POST /v1/tools/{tool}` | 결정적 도구 직접 실행 (LLM 불필요): 검색, 메타데이터 조회, 버전 매칭 | F-1.1, F-1.4, F-2.3 |
| `POST /v1/agent/runs` | 에이전트 작업 실행, `text/event-stream` 응답 | F-7.1~F-7.5 |
| `POST /v1/citations/fetch` | 지정 Work들의 인용 관계 즉시 수집 → `citationCache` | F-2.2.1 |

### 1.3 `POST /v1/tools/{tool}`

요청 본문은 해당 도구의 입력 스키마 그대로, 응답은 도구 출력 그대로. 서버는 인증·속도 제한·타임아웃만 덧붙인다. 허용 목록: 레지스트리에서 `exposed: true`인 도구만.

### 1.4 `POST /v1/agent/runs`

```json
{
  "task": "summarize | suggest_annotations | qa | compare_qa | suggest_relations | search",
  "model": { "provider": "gemini | openai | anthropic | llama", "model": "<model id>" },
  "context": {
    "works": [{ "workId": "…", "versionId": "…", "text": "<pdf.js 추출 본문 또는 선택 영역>", "section": "optional" }],
    "question": "qa/compare_qa일 때",
    "query": "search일 때"
  },
  "save": { "asNote": true, "templateId": null }
}
```

SSE 이벤트:

| event | data |
| --- | --- |
| `status` | `{step: "retrieving" \| "calling_tool" \| "generating", tool?}` |
| `token` | `{text}` — 생성 토큰 스트림 |
| `result` | 작업별 결과 (아래) |
| `error` | 공통 오류 형식 |
| `done` | `{runId}` |

작업별 결과와 저장:

| task | result | Firestore 기록 |
| --- | --- | --- |
| summarize | `{markdown, keywords[]}` | `notes` (kind=`ai_summary`, workIds) — `save.asNote`일 때 |
| suggest_annotations | `{annotations: {anchor, comment}[]}` | `annotations` (createdBy=agent, status=suggested) |
| qa / compare_qa | `{markdown, citations: {workId, quote}[]}` | `notes` (kind=`ai_qa`) — 선택 |
| suggest_relations | `{links: {from, to, type, rationale}[]}` | `links` (createdBy=agent, status=suggested) |
| search | `{items: SearchItem[]}` | 저장 안 함 (사용자가 골라 추가) |

## 2. LangGraph 구성

- 작업마다 작은 그래프를 따로 둔다 (`graphs/summarize.py`, `graphs/qa.py` …). 하나의 거대 라우터 그래프로 시작하지 않는다.
- 공통 노드: `load_key` → `prepare_context`(길이 초과 시 청크 분할·맵리듀스) → `llm` ↔ `tools` 루프 → `format_result` → `persist`.
- 도구 호출은 `search`, `compare_qa`처럼 필요한 작업에서만 바인딩한다.
- 컨텍스트 길이: 모델별 최대 토큰을 `models.toml`에 두고, 초과 시 섹션 단위 분할.

## 3. LLM 라우팅 (F-7.6)

```python
def get_chat_model(provider: str, model: str, api_key: str | None) -> BaseChatModel:
    match provider:
        case "openai":    return ChatOpenAI(model=model, api_key=api_key)
        case "anthropic": return ChatAnthropic(model=model, api_key=api_key)
        case "gemini":    return ChatGoogleGenerativeAI(model=model, google_api_key=api_key)
        case "llama":
            if settings.APP_ENV != "dev":
                raise ProviderNotAllowed("llama")
            return ChatOpenAI(model=model, base_url=settings.LLAMA_BASE_URL, api_key="not-needed")
```

- provider별 사용 가능한 모델 목록은 `services/agent/config/models.toml`에서 관리 (코드에 하드코딩하지 않음). 최신 모델 ID는 M6 착수 시점에 각 공급자 문서로 갱신한다.
- llama server 모델 목록은 `GET {LLAMA_BASE_URL}/models`로 조회.

## 4. 에이전트 도구 ([ADR-0005](adr/0005-uv-tool-contract.md), [ADR-0010](adr/0010-tool-form-criteria.md))

### 4.0 형태 선택 기준

도구는 세 형태 중 하나다. 판단 순서와 세부 기준은 ADR-0010.

1. 사용자 uid 범위의 Firestore 접근·결과 저장 등 **서버의 신뢰된 문맥이 필요** → **내장 도구** (`services/agent/src/agent/tools/builtin/`)
2. 웜 리소스, 호출 간 상태, 도구 묶음, 30초 넘는 긴 작업 중 하나라도 해당 → **MCP 서버** (stdio, 컨테이너 내부)
3. 그 외 → **CLI** (기본값, 아래 4.1~4.3 계약)

외부 도구는 모두 `core.py`(로직) + `cli.py` / `mcp.py`(어댑터) 구조로 만들어, 형태를 바꿀 때 로직을 다시 쓰지 않는다.

### 4.1 패키지 형태

- 도구 하나 = `tools/<name>/` 아래 독립 uv 프로젝트, `[project.scripts]`에 같은 이름의 CLI 진입점.
- 설치: `uv tool install ./tools/<name>` (도구마다 격리 가상환경).

### 4.2 호출 규약

| 항목 | 규약 |
| --- | --- |
| 입력 | stdin으로 JSON 객체 하나 (UTF-8) |
| 출력 | stdout으로 JSON 객체 하나. **stdout에는 결과 외 아무것도 쓰지 않는다** |
| 로그 | stderr |
| `--schema` | 입력 JSON Schema를 stdout에 출력하고 종료 |
| `--output-schema` | 출력 JSON Schema 출력 |
| `--version` | 도구 버전 |
| 성공 | 종료 코드 0, `{"ok": true, "data": {...}}` |
| 실패 | 종료 코드 1, `{"ok": false, "error": {"code": "...", "message": "...", "retryable": bool}}` |
| 비밀 | 외부 API 키(S2 등)는 환경변수로만 받는다. 사용자 LLM 키는 절대 넘기지 않는다 |
| 타임아웃 | 레지스트리에 도구별 지정 (기본 30초). 서버가 초과 시 프로세스 종료 |

### 4.3 레지스트리 `services/agent/config/tools.toml`

```toml
[tools.arxiv-search]
transport = "cli"       # cli | mcp-stdio (ADR-0010)
command = "arxiv-search"
timeout_s = 20
exposed = true          # /v1/tools 로 직접 호출 허용
agent = true            # LangGraph 도구로 바인딩
description = "arXiv에서 키워드·저자·카테고리로 논문을 검색한다."
env = []

[tools.s2-citations]
transport = "cli"
command = "s2-citations"
timeout_s = 60
exposed = false
agent = true
env = ["S2_API_KEY"]
```

서버 시작 시 각 도구의 `--schema`를 읽어 LangChain `StructuredTool`로 감싼다. 스키마를 못 읽는 도구가 있으면 시작 실패(빠른 실패).

### 4.4 초기 도구 목록

| 도구 | 입력 요지 | 출력 요지 | 마일스톤 |
| --- | --- | --- | --- |
| `arxiv-search` | query, max_results, categories? | SearchItem[] | M5 |
| `openreview-search` | query, venue?, year? | SearchItem[] | M5 |
| `dblp-venue-search` | query, venues[], year_from? | SearchItem[] | M5 |
| `s2-citations` | paper_ids[] | {paperKey, references, citedBy}[] | M4 (서버 내부), M5 (도구화) |
| `pdf-extract` | pdf base64 또는 text | {doi?, arxiv?, titleCandidates[]} | M5 (M1은 브라우저 구현) |
| `version-match` | candidate, library[] | {match: work/none, relation: duplicate/version, score, reasons[]} | M5 |
| `note-search` | query, uid | 노트 검색 결과 | M6 (형태 미정: MCP 또는 내장, ADR-0010) |

ACL Anthology, CVF Open Access, OpenAlex 검색 도구는 M5 범위 안에서 우선순위 순으로 추가한다 (09-open-issues I-08).

공통 `SearchItem`:

```json
{ "source": "arxiv", "title": "…", "authors": ["…"], "year": 2024, "venue": "ICLR",
  "ids": { "arxiv": "2401.01234", "doi": null, "openreview": null, "s2": null },
  "abstract": "…", "pdfUrl": "…" }
```

## 5. 버전·venue 매칭 (F-1.4, F-2.3) — `version-match`

1. 1차 식별자 일치: arXiv ID(버전 접미사 제거), DOI(소문자), OpenReview forum ID, S2 paper ID. S2/OpenAlex가 주는 교차 식별자(arXiv↔DOI)도 사용.
2. 2차 휴리스틱: 정규화 제목 유사도 ≥ 0.92 (값은 평가셋으로 조정) **그리고** 제1저자 성 일치 **그리고** 연도 차 ≤ 2.
3. 분기: 파일 해시 같음 → `duplicate`(병합), 다름 → `version`(같은 Work에 버전 추가).
4. 결과에 `reasons[]`(어떤 규칙으로 일치했는지)를 넣어 UI에서 보여주고 사용자가 확정한다.

## 6. 주기 작업 `citation-refresh` (F-2.2.1, F-1.4.3)

- 진입점: `python -m agent.jobs.citation_refresh`
- 스케줄: Cloud Scheduler, 매일 1회 (시간대 Asia/Seoul 새벽).
- 처리: `lastFetchedAt` 오래된 순으로 배치 → S2 batch API → `citationCache` 갱신.
- 새 버전 감지: 라이브러리의 arXiv ID에 대해 최신 버전 번호 조회, 증가했으면 해당 사용자 `notifications`에 기록.
  사용자별 라이브러리를 순회해야 하므로 job은 Admin SDK로 `collectionGroup('versions')`를 읽는다.

## 7. 설정 (환경 변수)

[07-dev-environment.md](07-dev-environment.md#환경-변수) 참고.

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
| 0.2.0 | 2026-10-19 | 도구 형태 선택 기준(내장·CLI·MCP) 추가, 레지스트리 transport 필드 (ADR-0010) |
