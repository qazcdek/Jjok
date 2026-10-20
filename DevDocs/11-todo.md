---
doc_id: DEV-011
title: 할 일
version: 0.1.0
status: draft
updated: 2026-10-20
sources:
  - DevDocs/10-milestone-tasks.md (0.5.0)
---

# 할 일

아직 끝나지 않은 작업. 작업 ID와 견적은 [DEV-010](10-milestone-tasks.md)을 따른다.
끝나면 이 문서에서 지우고 [DEV-012 한 일](12-done.md)에 옮긴다. 끝난 작업에서 나온 문제는 [DEV-013 고칠 것](13-fixes.md)에 적는다.
설계 결정이 필요한 것은 [DEV-009](09-open-issues.md)에 둔다.

상태: `진행 중` · `대기`(앞선 작업이나 사용자 조치를 기다림) · `예정`.
일부만 끝난 작업은 끝난 부분을 DEV-012에 적고, 여기에는 남은 부분만 둔다.

## 지금 하는 것 — M1 라이브러리 코어 (브랜치 `feat/M1-metadata`)

| ID | 남은 일 | 상태 | 메모 |
| --- | --- | --- | --- |
| M1-04 | 실제 환경(dev `jjok-20fd1`)에서 PDF 업로드 → 메타데이터 자동 채움 확인 | 진행 중 | 웹 `pnpm dev:cloud` + 에이전트 서버. 실제 ID 토큰 검증도 이때 확인 |
| M1-04 | Semantic Scholar API 키 적용 (`services/agent/.env` `S2_API_KEY`) | 대기 | 사용자가 키 신청 중. 키가 없으면 S2 를 건너뛴다 |
| M1-05 | 추출 실패·후보 여러 개일 때 사용자 확인·수동 입력 UI, 다시 조회 버튼 | 예정 | FX-06 도 여기서 해결 |
| M1-06 | 식별자로 추가 (DOI, arXiv ID) | 예정 | OpenReview 는 봇 차단으로 M5-02 에서 (DEV-013 FX-08) |
| M1-01 | 대표 버전 지정 UI | 예정 | 모델(`primaryVersionId`)은 있음 |
| M1-02 | 드래그 앤 드롭, 여러 파일 한 번에 올리기 | 예정 | 먼저 FX-01·FX-02 해결 |
| M1-07 | 축·컬렉션 CRUD, Work 소속 지정 | 예정 | |
| M1-08 | 자동 축 (연도·저자·venue) | 예정 | |
| M1-09 | 축 교차 필터 + 목록 UI | 예정 | 지금 목록은 M0 시험 화면(`features/m0`) |
| M1-10 | 태그 | 예정 | |
| M1-12 | 메타데이터 평가셋 50편 + 평가 스크립트, 90% 이상 | 예정 | 하네스 `apps/web/eval/metadata` 있음. 지금 3편 |
| — | 문서 반영: DEV-005 도구 목록에 `metadata-lookup`, DEV-007 메타데이터 조회에 에이전트 서버 필요, DEV-010 M5-01·M5-08 앞당김 표시 | 예정 | |
| — | `feat/M1-metadata` PR | 대기 | 위 확인 뒤 |

## prod·출시 전 (M0 남은 것)

| ID | 남은 일 | 상태 | 메모 |
| --- | --- | --- | --- |
| M0-03 | prod 프로젝트 `jjok-prod` 생성, Hosting, Auth(Google) | 예정 | 베타 전 |
| M0-04 | 결제 연결(Blaze), 예산 월 2만 원 + 알림, Cloud Run 최대 인스턴스 1~2 | 예정 | 무료 한도 확인 결과는 DEV-009 I-02 |
| M0-05 | prod 동의 화면, 승인된 도메인 | 예정 | |
| M0-12 | 개인정보처리방침 빈 값 채우기 → prod Hosting 배포 → 동의 화면 URL 등록 → 브랜딩 검증 신청 | 예정 | 빈 값 목록은 DEV-009 I-12 |
| — | 에이전트 서버 Cloud Run 배포 | 예정 | 배포 전에는 prod 에서 메타데이터 조회가 안 된다. 원래 M7-05 |
| — | GA 콘솔 설정: 데이터 보관 2개월, Google 신호 끄기 | 예정 | ADR-0011 |

## 사용자 조치

| 할 일 | 상태 |
| --- | --- |
| Semantic Scholar API 키 신청 → 받으면 알려 주기 | 대기 |

## 다른 컴퓨터에서 이어서 하기

git 에 없는 파일(`.gitignore`)은 새 컴퓨터에서 다시 만든다. 기본 설치는 루트 `README.md`, 자세한 값은 DEV-007 §4.

1. `git clone git@github-qazcdek:qazcdek/Jjok.git` → `git switch feat/M1-metadata` (PR 전이면) → `pnpm install`
2. git 작성자 설정: `git config user.name qazcdek`, `git config user.email qazcde.k@gmail.com`
3. 로그인: `pnpm exec firebase login`, `gh auth login` (계정 qazcdek)
4. `apps/web/.env.local`: `.env.example` 복사 (에뮬레이터용)
5. `apps/web/.env.cloud.local` (dev 프로젝트용): `VITE_USE_EMULATORS=false`, `VITE_DRIVE_BACKEND=google`, Firebase 값은 `pnpm exec firebase apps:sdkconfig WEB --project jjok-20fd1` 출력에서, `VITE_GOOGLE_OAUTH_CLIENT_ID` 는 Google Cloud 콘솔 → API 및 서비스 → 사용자 인증 정보의 웹 클라이언트 ID. 그 밖의 키(`VITE_APP_ENV`, `VITE_AGENT_BASE_URL`)는 `.env.example` 과 같다
6. `services/agent/.env`: `.env.example` 복사 → `FIREBASE_PROJECT_ID=jjok-20fd1`, 에뮬레이터 줄 삭제, `S2_API_KEY` (받았으면)
7. 실행: `pnpm dev:cloud` (웹 5173) + `pnpm dev:agent` (서버 8000). 웹 클라이언트 원본이 `http://localhost:5173` 만 등록되어 있으니 그 주소로 연다
8. 평가용 PDF 는 저장소에 없다 (저작권). 지금 쓰는 3편: arXiv `1706.03762`, ACL Anthology `N19-1423`, CVF CVPR 2016 ResNet. `PDF_DIR=<폴더> pnpm --filter @jjok/web eval:metadata`

## M2 이후

[DEV-010](10-milestone-tasks.md)의 M2~M7 작업 전체가 할 일이다. 마일스톤을 시작할 때 이 문서로 옮겨 상태를 관리한다.
앞당겨 끝낸 부분은 DEV-012 에 있다 (M5-01 일부, M5-08).

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-20 | 최초 작성 (DEV-010 진행 현황에서 분리) |
