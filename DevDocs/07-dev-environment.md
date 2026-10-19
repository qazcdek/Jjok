---
doc_id: DEV-007
title: 개발 환경 · 저장소 구조 · 컨벤션
version: 0.3.0
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
    _toolkit/               공용 CLI 계약 구현 (jjok-toolkit: run_cli, 계약 테스트 도우미)
    _template/              새 도구 템플릿 (core·cli 구조, ADR-0010)
    arxiv-search/           uv tool 패키지 (도구당 하나, M5~)
    ...
  packages/
    schema/                 JSON Schema 원본 → TS·Pydantic 생성
  firebase/
    firestore.rules
    firestore.indexes.json
    tests/                  보안 규칙 테스트
  e2e/                      Playwright E2E
  firebase.json, .firebaserc   Firebase CLI 설정 (루트: CLI 가 위로 올라가며 찾는다)
  .github/workflows/        CI
```

## 2. 필요 도구

| 도구 | 버전(최소) | 용도 |
| --- | --- | --- |
| Node.js | **24.22.0** (`.npmrc` `use-node-version`) | 웹 앱, Firebase CLI. pnpm 이 프로젝트 안에서 내려받아 쓰므로 시스템 Node 버전과 무관 |
| pnpm | 10.30 (`packageManager`) | JS 패키지 관리 (workspace) |
| Python | 3.12 (`.python-version`) | 에이전트 서버, 도구 |
| uv | 0.11+ | Python 패키지·도구 관리 |
| Firebase CLI | 15.x (루트 devDependency) | 에뮬레이터, 배포. 전역 설치 불필요: `pnpm exec firebase` |
| Java | 21 | Firestore 에뮬레이터 실행 |
| gcloud CLI | 최신 | Cloud Run, KMS, Scheduler |
| llama.cpp `llama-server` | 선택 | dev 로컬 LLM |

> Node 는 24 이상이 필요하다: vitest 5 는 22.12+, `@firebase/rules-unit-testing` 6 은 24.12+ 를 요구한다 (2026-10 기준). Node 20 은 지원 종료.
>
> TypeScript 는 6.0 계열로 고정한다. 7.0 이 나왔지만 typescript-eslint 가 `<6.1` 까지만 지원한다 (2026-10 기준).

## 3. 로컬 실행

```bash
# 1) 의존성
pnpm install
uv sync --project services/agent
cp apps/web/.env.example apps/web/.env.local          # 에뮬레이터 기본값
cp services/agent/.env.example services/agent/.env

# 2) Firebase 에뮬레이터 (Auth :9099, Firestore :8085, UI :4000), 프로젝트 ID demo-jjok
pnpm emulators

# 3) 에이전트 서버 → http://localhost:8000/healthz
pnpm dev:agent

# 4) 웹 앱 → http://127.0.0.1:5173 으로 접속
pnpm dev:web

# 5) (선택) 로컬 LLM
llama-server -m <model.gguf> --port 8080   # LLAMA_BASE_URL=http://localhost:8080/v1
```

> dev DB는 Firestore 에뮬레이터가 기본이다 ([ADR-0009](adr/0009-dev-database.md)). SQLite는 쓰지 않는다.
>
> 에뮬레이터 프로젝트 ID 는 `demo-jjok` 이다. `demo-` 로 시작하는 ID 는 클라우드 프로젝트 없이 에뮬레이터만 쓰며, 실수로 실제 리소스에 접근하지 않는다.
>
> **에뮬레이터 모드에서는 `127.0.0.1` 로 접속한다.** 앱을 `localhost` 로 열면 Auth 에뮬레이터 팝업(127.0.0.1:9099)과 사이트가 달라 브라우저 저장소 분리 때문에 팝업 로그인 결과가 앱에 전달되지 않는다 (M0 E2E 에서 확인).
>
> Drive는 에뮬레이터가 없다. 에뮬레이터 모드에서는 `VITE_DRIVE_BACKEND=memory`(기본)로 메모리 구현을 쓴다. 실제 Drive 는 `jjok-dev` 프로젝트에 붙여 `VITE_USE_EMULATORS=false`, `VITE_DRIVE_BACKEND=google` 로 확인한다.

## 4. 환경 변수

### 웹 앱 (`apps/web/.env.local`, git 제외)

| 변수 | 예 | 설명 |
| --- | --- | --- |
| `VITE_APP_ENV` | `dev` | UI 노출 제어 (llama 옵션 등). 보안 판단은 서버가 한다 |
| `VITE_FIREBASE_*` | — | Firebase 웹 설정 (apiKey, authDomain, projectId, appId) |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | — | Drive 토큰 갱신용 GIS 클라이언트 |
| `VITE_AGENT_BASE_URL` | `http://localhost:8000` | |
| `VITE_USE_EMULATORS` | `true` | `true` 면 Firebase 설정은 demo 값으로 자동 채움 |
| `VITE_DRIVE_BACKEND` | `memory` \| `google` | 기본: 에뮬레이터면 memory, 아니면 google |

### 에이전트 서버 (`services/agent/.env`, git 제외 / prod는 Secret Manager)

| 변수 | 예 | 설명 |
| --- | --- | --- |
| `APP_ENV` | `dev` \| `prod` | N-06 |
| `FIREBASE_PROJECT_ID` | `demo-jjok` (에뮬레이터) / `jjok-dev` | |
| `FIREBASE_AUTH_EMULATOR_HOST` | `127.0.0.1:9099` | 설정 시 Admin SDK 가 에뮬레이터 토큰을 검증 |
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
- 생성: `pnpm schema:gen` → `apps/web/src/lib/schema/*.ts` (json-schema-to-typescript), `services/agent/src/agent/schema/*_schema.py` (datamodel-code-generator 0.86, Pydantic v2, `uvx` 로 실행).
- Python 생성물은 저장소 밖 임시 폴더에서 만든 뒤 복사한다. 저장소의 ruff 설정이 생성기 포매팅에 섞이면 생성이 실패하기 때문이다.
- CI에서 생성물이 최신인지 검사 (`pnpm --filter @jjok/schema check`: 생성 후 `git status` 로 변경·새 파일 확인).

## 6. 컨벤션

### 브랜치·커밋

- 원격 저장소: `git@github-qazcdek:qazcdek/Jjok.git` (GitHub, `origin`).
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
| `ci-e2e` | `main` 푸시, 수동 | 에뮬레이터 + Playwright E2E |
| `deploy-dev` | `main` 머지 | Hosting(dev 채널), Cloud Run(dev) |
| `deploy-prod` | 태그 `v*` | Hosting, Firestore rules/indexes, Cloud Run, job |

GCP 인증은 Workload Identity Federation (서비스 계정 키 파일 저장 금지).

## 8. 비용 관리 (예산: 백엔드·DB 월 2만 원)

- GCP 결제 계정에 예산 **월 20,000원**을 걸고 50% / 90% / 100%에서 메일 알림을 받는다. 알림 메일: qazcde.k@gmail.com.
- **예산 알림은 과금을 멈추지 않는다.** 그래서 서비스 쪽에 상한을 직접 둔다.
  - Cloud Run: `min-instances=0`, `max-instances=2`, 요청 타임아웃 300초.
  - citation-refresh job: 하루 1회, 한 번에 처리하는 논문 수 상한.
  - Firestore: 목록은 전체 구독 1회 + 오프라인 캐시, 반복 폴링 금지. M4·M7에서 사용량 점검 (N-05).
  - KMS: 키 1개만 사용.
- dev는 에뮬레이터를 기본으로 써서 클라우드 사용량을 늘리지 않는다 (ADR-0009).
- LLM 비용은 사용자 키로 나가므로 이 예산에 포함하지 않는다 (N-04).
- (선택) 예산 100% 도달 시 Pub/Sub → Cloud Run 서비스 중지 자동화는 M7에서 검토.

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
| 0.2.0 | 2026-10-19 | 원격 저장소, dev DB(에뮬레이터), 비용 관리(월 2만 원) 추가 |
| 0.3.0 | 2026-10-19 | M0 구현 반영: Node 24.22, TS 6.0, firebase.json 루트, demo-jjok 에뮬레이터, 127.0.0.1 접속, 실행 스크립트, 스키마 생성 방식 |
