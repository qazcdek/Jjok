---
doc_id: DEV-007
title: 개발 환경 · 저장소 구조 · 컨벤션
version: 0.1.0
status: draft
updated: 2026-10-19
sources:
  - UserDocs/v1 개발 계획.md — M0, 기술 스택 제안
---

# 개발 환경 · 저장소 구조 · 컨벤션

## 1. 저장소 구조 (모노레포)

```
Jjok/
  UserDocs/                 제품 문서 (기능 명세, 개발 계획)
  DevDocs/                  개발 문서 (이 폴더)
  apps/
    web/                    React + TS + Vite
  services/
    agent/                  FastAPI + LangGraph (uv 프로젝트)
      src/agent/
        api/                라우터
        graphs/             LangGraph 작업별 그래프
        llm/                라우팅, models.toml 로더
        tools/              레지스트리, 서브프로세스 래퍼
        keys/               KeyCipher (KMS / 로컬)
        jobs/               citation_refresh
      config/               tools.toml, models.toml
      tests/
  tools/
    arxiv-search/           uv tool 패키지 (도구당 하나)
    openreview-search/
    ...
  packages/
    schema/                 JSON Schema 원본 → TS·Pydantic 생성
  firebase/
    firebase.json
    firestore.rules
    firestore.indexes.json
  .github/workflows/        CI
```

## 2. 필요 도구

| 도구 | 버전(최소) | 용도 |
| --- | --- | --- |
| Node.js | 22 LTS | 웹 앱, Firebase CLI |
| pnpm | 9 | JS 패키지 관리 (workspace) |
| Python | 3.12 | 에이전트 서버, 도구 |
| uv | 최신 | Python 패키지·도구 관리 |
| Firebase CLI | 최신 | 에뮬레이터, 배포 |
| Java | 11+ | Firestore 에뮬레이터 실행 |
| gcloud CLI | 최신 | Cloud Run, KMS, Scheduler |
| llama.cpp `llama-server` | 선택 | dev 로컬 LLM |

> 버전은 M0에서 확정해 `.nvmrc`, `.python-version`에 고정한다.

## 3. 로컬 실행

```bash
# 1) 의존성
pnpm install
uv sync --project services/agent
for t in tools/*/; do uv tool install --editable "$t"; done

# 2) Firebase 에뮬레이터 (Auth, Firestore)
firebase emulators:start --project jjok-dev

# 3) 에이전트 서버
APP_ENV=dev uv run --project services/agent uvicorn agent.main:app --reload --port 8000

# 4) 웹 앱
pnpm --filter web dev        # http://localhost:5173

# 5) (선택) 로컬 LLM
llama-server -m <model.gguf> --port 8080   # LLAMA_BASE_URL=http://localhost:8080/v1
```

> Drive는 에뮬레이터가 없다. dev에서도 실제 Google 계정과 dev OAuth 클라이언트를 쓴다. Drive 호출을 인터페이스 뒤에 두고, 단위 테스트에서는 메모리 구현으로 바꾼다.

## 4. 환경 변수

### 웹 앱 (`apps/web/.env.local`, git 제외)

| 변수 | 예 | 설명 |
| --- | --- | --- |
| `VITE_APP_ENV` | `dev` | UI 노출 제어 (llama 옵션 등). 보안 판단은 서버가 한다 |
| `VITE_FIREBASE_*` | — | Firebase 웹 설정 (apiKey, authDomain, projectId, appId) |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | — | Drive 토큰 갱신용 GIS 클라이언트 |
| `VITE_AGENT_BASE_URL` | `http://localhost:8000` | |
| `VITE_USE_EMULATORS` | `true` | |

### 에이전트 서버 (`services/agent/.env`, git 제외 / prod는 Secret Manager)

| 변수 | 예 | 설명 |
| --- | --- | --- |
| `APP_ENV` | `dev` \| `prod` | N-06 |
| `FIREBASE_PROJECT_ID` | `jjok-dev` | |
| `GOOGLE_APPLICATION_CREDENTIALS` | 경로 | dev 전용, prod는 서비스 계정 |
| `KEY_CIPHER` | `local` \| `kms` | |
| `KMS_KEY_NAME` | `projects/…/cryptoKeys/user-api-keys` | prod |
| `LOCAL_KEYSET_PATH` | `.secrets/dev-keyset.json` | dev |
| `LLAMA_BASE_URL` | `http://localhost:8080/v1` | dev 전용 |
| `S2_API_KEY` | — | Semantic Scholar |
| `OPENALEX_MAILTO` | 연락처 이메일 | OpenAlex polite pool |
| `CORS_ORIGINS` | `http://localhost:5173` | |

`.env.example` 파일을 각 위치에 두고 실제 값 파일은 `.gitignore`에 넣는다.

## 5. 공유 스키마

- 원본: `packages/schema/*.schema.json` (03-data-model의 엔티티, 05의 API 요청/응답).
- 생성: `pnpm schema:gen` → `apps/web/src/lib/schema/*.ts` (json-schema-to-typescript), `services/agent/src/agent/schema/*.py` (datamodel-code-generator, Pydantic v2).
- CI에서 생성물이 최신인지 검사 (생성 후 `git diff --exit-code`).

## 6. 컨벤션

### 브랜치·커밋

- 기본 브랜치 `main`. 작업 브랜치 `feat/M1-upload`, `fix/…`, `docs/…`.
- 커밋 메시지: Conventional Commits + 요구사항 ID
  - `feat(library): PDF 업로드 시 DOI 추출 [F-1.2]`
  - `docs(DEV-003): Work.nickname 추가`
- 1인 개발이라도 마일스톤 단위 PR로 묶어 셀프 리뷰 → 완료 기준 체크 후 머지.

### 코드 스타일

| 언어 | 도구 |
| --- | --- |
| TS/React | ESLint + Prettier, `strict: true` |
| Python | ruff (lint + format), mypy 또는 pyright |

### 문서

- 설계 변경은 코드보다 문서 먼저 (또는 같은 PR). 규칙은 [README.md](README.md#버전-관리-규칙).

## 7. CI/CD (GitHub Actions 가정)

| 워크플로 | 트리거 | 작업 |
| --- | --- | --- |
| `ci-web` | PR, `apps/web/**` | lint, typecheck, vitest, build |
| `ci-agent` | PR, `services/agent/**`, `tools/**` | ruff, 타입 검사, pytest, 도구 계약 테스트 |
| `ci-rules` | PR, `firebase/**` | 에뮬레이터에서 보안 규칙 테스트 |
| `ci-schema` | PR, `packages/schema/**` | 생성물 최신 여부 |
| `deploy-dev` | `main` 머지 | Hosting(dev 채널), Cloud Run(dev) |
| `deploy-prod` | 태그 `v*` | Hosting, Firestore rules/indexes, Cloud Run, job |

GCP 인증은 Workload Identity Federation (서비스 계정 키 파일 저장 금지).

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
