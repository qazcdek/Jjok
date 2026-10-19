# Jjok

노트를 중심에 둔 논문 관리 웹 앱. 제품 문서는 [UserDocs/](UserDocs/), 개발 문서는 [DevDocs/](DevDocs/README.md).

## 빠른 시작 (로컬 에뮬레이터)

필요: pnpm 10, uv, Java 21. Node 는 pnpm 이 `.npmrc` 의 버전(24.22.0)을 프로젝트 안에서 받아 쓴다.

```bash
pnpm install
uv sync --project services/agent

pnpm emulators          # Auth·Firestore 에뮬레이터 (UI: http://127.0.0.1:4000)
pnpm dev:web            # 웹 앱 → http://127.0.0.1:5173 으로 접속 (localhost 아님, 아래 참고)
pnpm dev:agent          # 에이전트 서버 http://localhost:8000/healthz
```

에뮬레이터 모드에서는 반드시 `127.0.0.1` 로 접속한다. Auth 에뮬레이터 팝업(127.0.0.1:9099)과 앱이 같은 사이트여야 브라우저가 팝업 로그인 결과를 앱에 전달한다.

## 테스트

```bash
pnpm test               # 웹 단위 테스트
pnpm rules:test         # Firestore 보안 규칙 (에뮬레이터)
pnpm e2e                # M0 E2E (에뮬레이터 + Playwright, 최초 1회: pnpm --filter @jjok/e2e install-browsers)
(cd services/agent && uv run pytest)
(cd tools/_template && uv run pytest)
```

## 구조

```
apps/web            React + TS + Vite
services/agent      FastAPI (+ LangGraph, M5~)
tools/_toolkit      uv tool 공용 CLI 계약
tools/_template     새 도구 템플릿
packages/schema     JSON Schema → TS / Pydantic 생성 (pnpm schema:gen)
firebase            보안 규칙·인덱스·규칙 테스트
e2e                 Playwright
```
