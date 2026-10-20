---
doc_id: DEV-002
title: 시스템 아키텍처
version: 0.4.0
status: draft
updated: 2026-10-20
sources:
  - UserDocs/기능 명세.md (v0.1) — 기술 설계 메모
  - UserDocs/v1 개발 계획.md — 기술 스택 제안
---

# 시스템 아키텍처

## 1. 구성 요소

```
┌──────────────────────── 브라우저 (React SPA) ────────────────────────┐
│  리더(pdf.js) · 노트 에디터(CodeMirror 6) · 그래프(Cytoscape.js)      │
│  파생 문서 검색 인덱스(MiniSearch) · Firestore SDK(오프라인 캐시)     │
└──────┬──────────────────┬──────────────────────┬────────────────────┘
       │ Firebase Auth     │ Firestore            │ Drive REST (drive.file)
       │ (Google 로그인)    │ (메타데이터·노트 등)  │ PDF 업로드/다운로드
       ▼                   ▼                      ▼
  Firebase Auth       Cloud Firestore         사용자 Google Drive
                           ▲                  /Jjok/files/<workId>/<versionId>.pdf
                           │ Admin SDK
┌──────────────────────────┴──── 백엔드 서버 services/api (Cloud Run) ┐
│  FastAPI  ── 인증(Firebase ID 토큰 검증)                              │
│  [api]   메타데이터 조회 (arXiv·Crossref·S2·OpenAlex, M1~)           │
│     └─ 도구 레지스트리 ── 내장 도구 + uv tool 서브프로세스 (JSON)     │
│            arxiv-search, openreview-search, dblp-venue-search,       │
│            s2-citations, pdf-extract, version-match, note-search     │
│  [agent] LangGraph 에이전트 ── LLM 라우터 ─→ Gemini / OpenAI / Claude │
│     │    (M6~)                         └→ llama server (dev 전용)    │
│     └─ 키 관리 ── Cloud KMS (BYOK 키 암복호화)                        │
└─────────────────────────────────────────────────────────────────────┘
  M6에서 같은 이미지로 Cloud Run 서비스 2개(jjok-api, jjok-agent)로 나눈다 (ADR-0012)
  Cloud Scheduler ─→ Cloud Run job (citation-refresh): 인용 관계 주기 갱신
  외부 API: arXiv, OpenReview, DBLP, ACL Anthology, CVF, Semantic Scholar, OpenAlex
```

### 책임 분리

| 구성 요소 | 책임 | 하지 않는 것 |
| --- | --- | --- |
| 웹 앱 | UI, Firestore 직접 읽기/쓰기, Drive 직접 업/다운로드, 검색 인덱스, PDF 텍스트 추출(pdf.js) | API 키 보관, LLM 직접 호출 |
| Firestore | 사용자 데이터의 단일 진실 원천, 실시간 동기화 | 대용량 파일 저장 |
| Google Drive | PDF 원본 | 메타데이터 |
| 백엔드 서버 · api 모듈 | 외부 메타데이터 조회·소스 검색(외부 API 키 보관), 버전 매칭, 도구 실행 | LLM 호출, 사용자 LLM 키 접근 |
| 백엔드 서버 · agent 모듈 | LLM 호출, BYOK 키 암복호화, 에이전트가 만든 결과의 Firestore 기록 | PDF 원본 장기 보관 |
| citation-refresh job | 인용 그래프 캐시 갱신, 새 버전 감지 | 사용자 요청 처리 |

## 2. 실행 환경

| 항목 | dev | prod |
| --- | --- | --- |
| `APP_ENV` | `dev` | `prod` |
| 웹 앱 | `vite dev` (localhost) | Firebase Hosting |
| 백엔드 서버 | 로컬 `uvicorn` (`pnpm dev:api`) | Cloud Run (M6부터 api·agent 2개 서비스) |
| Firebase (Auth·Firestore) | **Firebase Emulator Suite (기본)**, 실제 계정·여러 기기 테스트 때만 `jjok-dev` 프로젝트 | `jjok-prod` 프로젝트 |
| LLM | Gemini / OpenAI / Claude + **llama server** (`LLAMA_BASE_URL`) | Gemini / OpenAI / Claude |
| 키 암호화 | 로컬 개발용 키 (Tink 로컬 키셋 등) 또는 dev KMS 키 | Cloud KMS |

> 앱 이름은 **Jjok**으로 확정. 문서의 `jjok-dev`는 실제 프로젝트 ID **`jjok-20fd1`** 을 가리킨다 (2026-10-19 생성). prod 프로젝트는 베타 전에 만들고 ID를 여기에 적는다.
>
> dev 프로젝트는 무료(Spark) 요금제로 둔다. dev의 백엔드 서버는 로컬에서 돌고 키 암호화도 로컬 키셋을 쓰므로 Cloud Run·KMS가 필요 없다. 결제 연결이 필요한 것은 prod뿐이다.
>
> dev에서 SQLite를 쓰지 않고 Firestore 에뮬레이터를 쓰는 이유는 [ADR-0009](adr/0009-dev-database.md).

## 3. 주요 흐름

### 3.1 로그인 + 드라이브 권한 (F-6.1)

1. 사용자가 "Google로 로그인"을 누른다.
2. Firebase Auth `signInWithPopup(GoogleAuthProvider)`에 `drive.file` 스코프를 추가해 요청한다.
3. 결과 credential의 OAuth 액세스 토큰으로 Drive를 호출한다.
4. 액세스 토큰은 약 1시간 후 만료되며 Firebase가 갱신해 주지 않는다. 갱신은 Google Identity Services 토큰 클라이언트로 처리한다 → [09-open-issues.md I-03](09-open-issues.md).

### 3.2 PDF 업로드 (F-1.2)

1. 브라우저에서 파일 SHA-256 해시 계산 → 같은 해시의 버전이 있으면 "중복" 처리 (F-2.3).
2. pdf.js로 첫 1~2페이지 텍스트 추출 → DOI / arXiv ID 정규식 탐색, 실패 시 제목 후보 추출.
3. 메타데이터 조회 (식별자 → arXiv/Crossref/S2/OpenAlex, 제목 → S2/OpenAlex 검색). **M1부터 백엔드 서버 `/v1/tools/*`를 거친다.** 브라우저에서 직접 부르지 않는 이유: arXiv API가 CORS 헤더를 주지 않고, S2·OpenAlex 키를 브라우저에 둘 수 없다 (2026-10-20 확인, ADR-0012).
4. Drive `/Jjok/files/<workId>/<versionId>.pdf`로 업로드, 받은 `driveFileId`를 Version 문서에 기록.
5. 매칭 실패 시 사용자 확인 UI로 수동 입력.

### 3.3 AI 요약 (F-7.1, F-4.6)

1. 웹 앱이 pdf.js로 본문 텍스트(또는 선택 영역)를 추출한다.
2. `POST /v1/agent/runs` (task=`summarize`, provider/model, text, workId, versionId) — SSE로 진행 상황 스트리밍.
3. 서버가 Firestore에서 해당 provider의 암호문 키를 읽고 KMS로 복호화 → LLM 호출 → 메모리에서만 사용.
4. 결과를 `notes` 컬렉션에 `kind: ai_summary`로 저장하고 Work와 연결. 웹 앱은 Firestore 구독으로 반영.

> 원문 텍스트를 클라이언트가 보내는 방식은 서버가 사용자 Drive 토큰을 들고 있지 않아도 되게 하기 위함이다 ([ADR-0002](adr/0002-firebase-and-drive.md), [09-open-issues.md I-04](09-open-issues.md)).

### 3.4 인용 관계 수집 (F-2.2.1)

1. 사용자가 논문을 추가하면 서버에 `s2-citations` 실행을 요청 → 공용 캐시 `citationCache/{paperKey}`에 references/citedBy 기록.
2. Cloud Scheduler가 하루 1회 `citation-refresh` job 실행 → `lastFetchedAt`이 오래된 항목부터 일괄 갱신 (S2 API 키, 속도 제한 준수).
3. 웹 앱은 사용자 라이브러리의 Work들과 캐시를 교차해 인용 엣지를 계산한다 (라이브러리 밖 논문은 "유령 노드"로 선택 표시).

## 4. 배포 단위

| 단위 | 위치 | 배포 |
| --- | --- | --- |
| `apps/web` | Firebase Hosting | `firebase deploy --only hosting` |
| `firebase/` (rules, indexes) | Firestore | `firebase deploy --only firestore` |
| `services/api` | Cloud Run 서비스 `jjok-api` (M6 전까지 agent 포함) | 컨테이너 이미지 (도구는 이미지 빌드 시 `uv tool install`) |
| `services/api` agent 진입점 | Cloud Run 서비스 `jjok-agent` (M6~) | 같은 이미지, 다른 진입점. KMS 복호화 권한은 이 서비스 계정에만 |
| `services/api` job 진입점 | Cloud Run job | 같은 이미지, 다른 명령 |

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
| 0.2.0 | 2026-10-19 | 앱 이름 Jjok 반영, dev DB를 Firestore 에뮬레이터로 확정 (ADR-0009) |
| 0.3.0 | 2026-10-19 | dev 프로젝트 ID jjok-20fd1, dev는 Spark 요금제 |
| 0.4.0 | 2026-10-20 | 에이전트 서버 → 백엔드 서버(api·agent 모듈), 메타데이터 조회를 M1부터 서버 경유, M6 서비스 분리 (ADR-0012) |
