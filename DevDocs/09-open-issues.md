---
doc_id: DEV-009
title: 설계 미결 사항 및 UserDocs 불일치
version: 0.3.2
status: draft
updated: 2026-10-20
sources:
  - UserDocs/기능 명세.md (v0.1)
  - UserDocs/v1 개발 계획.md (2026-10-19)
---

# 설계 미결 사항

기능 명세의 "미결 사항"은 모두 답이 나왔지만, 구현 단계에서 정해야 할 것들이 남아 있다.
끝난 작업의 버그·미확인 항목은 여기가 아니라 [DEV-013 고칠 것](13-fixes.md)에 둔다.
상태: `open`(미정) · `proposed`(제안안 있음, 확인 필요) · `resolved`(결정, 관련 문서 반영됨).

| ID | 주제 | 상태 | 기한 | 관련 |
| --- | --- | --- | --- | --- |
| I-01 | 위키 링크 문법 확정 | proposed | M3 시작 전 | F-4.2, DEV-006 §5 |
| I-02 | Firebase 요금제와 무료 한도 확인 | proposed | M0 | N-05, ADR-0002, DEV-007 §8 |
| I-03 | Drive 액세스 토큰 갱신 방식 | resolved | — | F-6.1, DEV-002 §3.1 |
| I-04 | AI 작업용 PDF 본문을 누가 추출하는가 | proposed | M5 | F-7.1, DEV-002 §3.3 |
| I-05 | 그래프 노드의 "사용자 닉네임" 필드 | proposed | M4 | F-3.3.1 |
| I-06 | 활성 노드 집합의 표시 위치와 동기화 여부 | open | M4 | F-3.3.2 |
| I-07 | 새 버전 알림의 "학회 채택" 감지 방법 | open | M5 | F-1.4.3 |
| I-08 | 소스 7종 중 M5에 넣을 범위 | proposed | M5 | F-1.1 |
| I-09 | 파생 문서 검색 엔진 (명세 FTS5 vs 계획 MiniSearch) | resolved | — | ADR-0004 |
| I-10 | 사용자 정의 관계 유형 목록 관리 | open | M4 | F-2.2.2 |
| I-11 | UserDocs의 임베드 다이어그램 미확인 | resolved | — | DEV-002 |
| I-12 | 개인정보처리방침과 공개 홈페이지 | open | 검증 신청 전 (M0~M1) | DEV-004 §1 |
| I-13 | dev DB 선택 (Firestore vs SQLite) | resolved | — | ADR-0009 |
| I-14 | 사용 통계 동의 방식 (옵트아웃 vs 옵트인) | open | 공개 출시 전 | ADR-0011 |

## 상세

### I-01 위키 링크 문법

- 제안: `[[노트 제목]]`, `[[노트 제목#^blockid]]`, `[[@citeKey]]`, `[[@citeKey#ann:<id>]]`, `[[대상|별칭]]` (DEV-006 §5).
- 논점: 논문을 citeKey로 가리키면 citeKey가 바뀔 때 링크가 깨진다 → citeKey 변경 시 일괄 치환하거나, 내부적으로 `[[@work:<workId>]]`로 저장하고 에디터에서만 citeKey로 보여주는 방법 중 선택.
- 노트 제목 중복을 허용할지 (허용하면 위키 링크 해석이 모호해진다).

### I-02 Firebase 요금제와 무료 한도

- **결정 (2026-10-19)**: 결제 계정을 연결한다. 백엔드·DB 예산은 월 2만 원. 비용 관리 방법은 DEV-007 §8. 남은 일은 아래 수치 확인.

- 기능 명세가 "무료 한도는 설계 시 확인"으로 남겨 두었다.
- Cloud Run, Cloud KMS, Cloud Scheduler, Secret Manager는 결제 계정이 연결된 GCP 프로젝트에서만 쓸 수 있다. 같은 프로젝트에 결제를 연결하면 Firebase도 Blaze(종량제)로 바뀌는 것으로 알고 있으나, 무료 사용량이 Blaze에서도 유지되는지 포함해 **M0에서 공식 문서로 확인**한다.
- 확인할 값: Firestore 일일 읽기/쓰기/삭제 무료량, 저장 용량, Cloud Run 무료 요청·vCPU 시간, KMS 키·연산 비용.
- 산출물: 베타 사용자 10명 기준 월 예상 비용 표를 이 문서에 추가. 예산 알림 설정.
- **확인 (2026-10-20, 공식 가격 문서)**: 무료 한도는 결제 계정이 있어야 쓸 수 있고, Blaze 에서도 유지된다. 매월 초기화, 기간 제한 없음.
  - Cloud Run(요청 기반 과금): 요청 200만 회, 18만 vCPU-초, 36만 GiB-초. 서울(`asia-northeast3`)도 적용되지만 Tier 1(미국) 단가 기준 금액 할인이라 서울에서는 조금 빨리 소진된다. 북미 외 데이터 전송은 유료이나 응답이 작아 원 단위.
  - Cloud Build 월 2,500분, Artifact Registry 0.5 GB(최신 이미지만 남기는 정리 규칙 필요), Secret Manager 비밀 6개·조회 1만 회, Cloud Logging 프로젝트당 50 GiB.
  - 혼자 쓸 때 추정(업로드 하루 100편, 조회 1회 5초): Cloud Run CPU 월 1.5만 vCPU-초 ≈ 한도의 10%. 예상 비용 월 0원 ~ 수백 원.
  - 예산 알림은 결제를 막지 않으므로 Cloud Run 최대 인스턴스를 1~2로 제한한다 (M0-04).
  - 남은 것: Firestore 무료량(읽기 5만/일, 쓰기 2만/일)은 베타 10명 기준 표에서 다시 확인, KMS 비용은 M6.

### I-03 Drive 액세스 토큰 갱신

- Firebase `signInWithPopup`이 주는 Google 액세스 토큰은 약 1시간 후 만료되고, Firebase가 갱신해 주지 않는다.
- 제안: Google Identity Services(GIS) 토큰 클라이언트(`google.accounts.oauth2.initTokenClient`, scope `drive.file`)로 만료 시 조용히 재발급(`prompt: ''`). 처음 로그인 때만 Firebase 팝업에서 스코프 동의.
- 대안: 서버에서 refresh token 보관 (보안 부담이 커서 비추천).
- M0 스파이크로 확인: 같은 OAuth 클라이언트로 두 흐름을 쓸 때 동의 화면이 두 번 뜨지 않는지.
- **진행 (2026-10-19)**: `apps/web/src/lib/drive/token.ts` 에 구현. 로그인 직후 Firebase credential 토큰을 쓰고, 만료(1시간)·401 시 GIS 로 재발급한다. 단위 테스트는 401 재시도까지 통과. **실제 Google 계정 확인은 `jjok-dev` 프로젝트 생성 후** 남아 있다.
- 알게 된 점: GIS 재발급은 팝업을 띄울 수 있어 사용자 클릭 안에서 호출되어야 한다. 새로고침 직후에는 드라이브 토큰이 없으므로 첫 드라이브 동작(클릭)에서 재발급된다.
- **resolved (2026-10-19)**: 실제 계정(dev `jjok-20fd1`)으로 확인. 새로고침 뒤 GIS `prompt: ''` 로 받은 토큰에 `drive.file` 이 빠져 Drive 가 403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` 를 돌려주는 경우가 있었다. 대응: (1) 토큰 응답의 `scope` 에 `drive.file` 이 없으면 `prompt: 'consent'` 로 다시 받는다, (2) 403 범위 부족 응답이면 재동의 후 한 번 재시도한다. 수정 후 새로고침 → 다시 받기·업로드 정상.
- 남은 관찰: 브라우저에 Google 계정이 여러 개일 때 다른 계정 토큰이 오는지는 확인하지 못했다. 생기면 `prompt: 'select_account'` 를 검토한다.

### I-04 AI 작업용 본문 추출 주체

- 제안: 브라우저 pdf.js로 추출한 텍스트를 서버에 보낸다. 서버가 사용자 Drive 토큰을 들고 있을 필요가 없다.
- 영향: 기능 명세의 `pdf-extract` 도구는 (1) 에이전트가 외부 검색 결과의 PDF URL을 읽을 때, (2) dev에서 CLI로 쓸 때 사용. 라이브러리 PDF는 클라이언트 추출 경로.
- 단점: 그림·표 구조 손실. v1에서는 텍스트만으로 충분하다고 가정.

### I-05 사용자 닉네임

- 기능 명세 3.3.1: "활성 노드는 논문 제목 또는 사용자 닉네임". 데이터 모델에 필드가 없다.
- 제안: `works.nickname?: string`. 그래프 라벨은 `nickname ?? 짧은 제목`. DEV-003 0.2.0에서 반영.

### I-06 활성 노드 집합

- 활성 노드를 그래프 위 라벨로만 보여줄지, 그래프 밖(하단 바)에도 목록으로 보여줄지.
- 기기 간 동기화할지 (Firestore `users/{uid}.ui.activeNodeIds`) 또는 기기별 localStorage로 둘지. 제안: 기기별.

### I-07 학회 채택 감지

- arXiv 새 버전은 arXiv API로 감지 가능. "학회 채택"은 OpenReview 결정, DBLP 신규 등재, S2의 venue 변경 중 무엇을 근거로 할지 정해야 한다.
- 제안: v1은 S2/OpenAlex의 venue·publicationTypes 변화 + OpenReview decision(해당 venue만). 정확도가 낮으면 알림이 아니라 "제안"으로 표시.

### I-08 소스 범위

- 개발 계획 M5: arXiv, OpenReview, DBLP, S2. 기능 명세: + ACL Anthology, CVF Open Access, OpenAlex.
- 제안: M5 필수 4종(계획대로), OpenAlex는 인용 수집용으로 M4에서 이미 연동되므로 검색도 M5에 추가, ACL Anthology·CVF는 M5 여유분 또는 v1.1.

### I-09 파생 문서 검색 엔진 — resolved

- 기능 명세는 "SQLite FTS5", 개발 계획은 "브라우저 MiniSearch". 웹 앱으로 결정됐으므로 개발 계획을 따른다. [ADR-0004](adr/0004-derived-search-in-browser.md). 기능 명세 다음 버전에서 문구 수정 필요.

### I-10 사용자 정의 관계 유형

- 기본 제공: `extends`(확장함), `refutes`(반박함), `reproduces`(재현함), `related`.
- 사용자가 유형을 추가할 수 있게 할지 → 추가하면 `users/{uid}/relationTypes` 컬렉션과 보안 규칙 목록 수정 필요.

### I-11 임베드 다이어그램

- UserDocs 두 문서에 `[embedded content: 시스템 구성 · 제안안]`, `[embedded content: v1 마일스톤 일정 · 22주]`가 자리표시로만 남아 있어 내용을 확인하지 못했다. DEV-002의 구성도와 DEV-010의 일정은 본문 텍스트·표를 근거로 작성했다. 원본 다이어그램과 다르면 맞춰 고친다.
- **resolved (2026-10-19)**: 사용자가 DEV-002 구성도가 원본과 맞다고 확인했다.

### I-12 개인정보처리방침과 공개 홈페이지

- Google OAuth 검증 신청에는 공개된 홈페이지와 개인정보처리방침 URL이 필요하다. 테스트 게시 상태(dev, 베타 100명 이하)에서는 없어도 된다.
- 개인정보처리방침에 들어갈 내용: 받는 Google 데이터(이름·이메일·프로필 사진, `drive.file`로 앱이 만든 파일), 쓰는 목적, 저장 위치(Firestore, 사용자 Drive), 사용자가 고른 LLM 공급자에게 논문 텍스트가 전송된다는 점, API 키 암호화 보관, 보관 기간과 삭제 요청 방법, 문의처(qazcde.k@gmail.com).
- 할 일: `apps/web/public/privacy.html`(또는 라우트) 초안 작성 → `jjok-prod` Hosting 배포 → 동의 화면에 URL 등록 → 검증 신청.
- **진행 (2026-10-19)**: 초안 작성 완료 `apps/web/public/privacy.html` (배포 시 `/privacy.html`). 앱 하단에 링크. 개인정보 보호법 제30조 기재 항목(처리 목적·항목·보유 기간·파기·위탁·국외 이전·권리 행사·안전성 조치·보호책임자)과 Google API 사용자 데이터 정책(Limited Use) 문구 포함.
- 게시 전에 채울 값 (페이지에 노란 표시): 시행일, Firestore·Cloud Run 리전(M0-03에서 결정, 서울 `asia-northeast3` 권장), 삭제 처리 기한(초안 30일), 서버 로그 보관 기간(초안 30일, Cloud Logging 보관 설정과 맞출 것), 보호책임자 성명.
- 법률 검토를 받은 문서가 아니다. 공개 출시 전에 검토를 권장한다.
- 수집 항목이 바뀌면 함께 고친다: M7 오류 수집 도구 도입, LLM 공급자 추가, 백업 도입 등.

### I-13 dev DB 선택 — resolved

- Firestore 에뮬레이터를 쓴다. SQLite는 쓰지 않는다. [ADR-0009](adr/0009-dev-database.md).

### I-14 사용 통계 동의 방식

- 현재 구현: Google Analytics 기본 켜짐, 앱 하단에서 끌 수 있음(옵트아웃). 방침에 고지.
- 논점: 국내 개인정보 보호법상 행태정보 수집에 별도 동의(옵트인 배너)가 필요한지. 해외 사용자(EU 등)를 받으면 동의 배너가 사실상 필수다.
- 비공개 베타는 테스트 사용자에게 직접 안내하는 것으로 충분하다고 가정한다. 공개 출시 전에 법률 검토로 정한다. 옵트인으로 바꾸면 `initAnalytics` 호출을 동의 이후로 옮기면 된다.

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
| 0.2.0 | 2026-10-19 | I-02 예산 결정, I-11 해소, I-12(개인정보처리방침)·I-13(dev DB) 추가 |
| 0.2.1 | 2026-10-19 | I-03 구현 진행 상황 기록 |
| 0.2.2 | 2026-10-19 | I-12 개인정보처리방침 초안 작성 |
| 0.3.0 | 2026-10-19 | I-14 사용 통계 동의 방식 추가, 방침에 Analytics 반영 |
| 0.3.1 | 2026-10-19 | I-03 해결 |
| 0.3.2 | 2026-10-20 | I-02 Cloud Run 등 무료 한도 확인, DEV-013 과의 구분 |
