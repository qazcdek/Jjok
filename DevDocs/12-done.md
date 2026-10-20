---
doc_id: DEV-012
title: 한 일
version: 0.1.0
status: draft
updated: 2026-10-20
sources:
  - DevDocs/10-milestone-tasks.md (0.5.0)
---

# 한 일

끝난 작업과 확인 방법. 최신 마일스톤을 위에 둔다.
끝난 뒤 문제가 발견되면 이 문서는 고치지 않고 [DEV-013 고칠 것](13-fixes.md)에 적는다. 이 문서의 `고칠 것` 칸에는 그 ID만 적는다.

- **완료**: 작업 범위를 다 했고 확인까지 마쳤다.
- **일부 완료**: 적힌 부분만 끝났다. 남은 부분은 [DEV-011 할 일](11-todo.md)에 있다.

## M1 라이브러리 코어 (브랜치 `feat/M1-metadata`, PR 전)

| ID | 상태 | 날짜 | 한 일 | 확인 | 커밋 | 고칠 것 |
| --- | --- | --- | --- | --- | --- | --- |
| M1-03 | 완료 | 2026-10-20 | PDF 앞 2페이지에서 DOI·arXiv·OpenReview ID, 1페이지 글씨 크기로 제목 후보, venue 문구(ICLR·CVF 워터마크·ACL Proceedings 등) 추출 | 단위 테스트, 실제 PDF 3편 제목 3/3 (`apps/web/eval/metadata`) | b42639c | |
| M1-04 | 일부 완료 | 2026-10-20 | `tools/metadata-lookup` 도구: DOI→Crossref, arXiv→arXiv API, 제목→OpenAlex·arXiv(+S2). venue 정규화, 출판판 우선·판 ID 병합. 업로드 흐름에 연결 | 도구 테스트 19건, 서버 테스트 | de36a6d, 4abace8 | FX-06, FX-07 |
| M1-11 | 완료 | 2026-10-20 | citeKey `성+연도+제목 첫 단어`, 라이브러리 안에서 중복 시 접미사 | 단위 테스트 | 4abace8 | FX-02 |
| M5-01 (일부) | 일부 완료 | 2026-10-20 | M1-04 를 위해 앞당김: `config/tools.toml` 레지스트리, CLI 실행기(시간 초과·출력 검증·환경 변수 제한), `POST /v1/tools/{name}`. 계약 테스트 하네스는 M5 | 서버 테스트 | de36a6d | |
| M5-08 | 완료 | 2026-10-20 | 메타데이터 조회를 처음부터 서버 도구로 구현 (브라우저에서 arXiv·DBLP CORS 불가, S2 키 노출, OpenReview 차단) | M1-04 와 같음 | de36a6d | |

## M0 기반 (PR #1, #2 → main, 2026-10-19)

완료 기준 통과: 에뮬레이터 E2E + dev 프로젝트 실제 계정으로 로그인 → 업로드 → 다시 받아 해시 일치, 새로고침 후에도 동일.

| ID | 상태 | 한 일 | 확인 | 고칠 것 |
| --- | --- | --- | --- | --- |
| M0-01 | 완료 | 모노레포, pnpm workspace, uv 프로젝트, ESLint/Prettier/ruff, `tools/_toolkit`·`tools/_template` | CI | |
| M0-02 | 완료 | 워크플로 5개 (ci-web, ci-rules, ci-agent, ci-schema, ci-e2e) | main 에서 전부 통과 | |
| M0-03 | 일부 완료 (dev) | dev `jjok-20fd1`: Firestore `(default)` Standard·`asia-northeast3`, 규칙·인덱스 배포, 웹 앱 `jjok-web`, Google 로그인 | 실제 계정 로그인 | |
| M0-05 | 일부 완료 (dev) | 동의 화면 테스트 상태(외부), 테스트 사용자, `drive.file`, 웹 클라이언트 원본 `http://localhost:5173` | 실제 계정 로그인 | |
| M0-06 | 완료 | 로그인 + `drive.file`, GIS 토큰 재발급, 범위 확인·403 재동의 (I-03) | 실제 계정, 새로고침 후 재발급 | FX-05 |
| M0-07 | 완료 | Drive 앱 폴더, 업로드(multipart·resumable), 다운로드. `/Jjok/files/<workId>/<versionId>.pdf` | 실제 Drive 에 파일 생성 확인 | FX-01, FX-03 |
| M0-08 | 완료 | User·Work·Version 스키마 + TS/Pydantic 생성 | ci-schema | |
| M0-09 | 완료 | 보안 규칙 + 테스트 13건 | 규칙에 구멍을 내면 실패하는 것까지 확인 | |
| M0-10 | 완료 | 에이전트 서버 `/healthz`, `/v1/me`, ID 토큰 검증, `APP_ENV` | 에뮬레이터 실제 토큰 | |
| M0-11 | 완료 | E2E `m0-auth-drive.spec.ts` | CI | FX-04 |
| M0-12 | 일부 완료 | 개인정보처리방침 초안 `apps/web/public/privacy.html`, 앱 하단 링크 | — | |
| M0-13 | 완료 | `pnpm emulators`, `.emulator-data` 보존 | 수동 | |

## 작업 ID 밖에서 한 일

| 날짜 | 한 일 | 관련 |
| --- | --- | --- |
| 2026-10-20 | 혼자 쓸 때 서버 비용 확인: Cloud Run·Cloud Build·Artifact Registry·Secret Manager 모두 무료 한도 안 | DEV-009 I-02 |
| 2026-10-19 | Google Analytics 연동 (개인정보 보호 기본값, 옵트아웃) | ADR-0011 |
| 2026-10-19 | 도구 형태 선택 기준 (내장 / CLI / MCP) | ADR-0010 |
| 2026-10-19 | DevDocs 0.1.0 작성, 버전 관리 규칙 | DEV-000 |

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-20 | 최초 작성 (DEV-010 진행 현황에서 분리, M1 진행분 추가) |
