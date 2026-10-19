---
doc_id: DEV-009
title: 설계 미결 사항 및 UserDocs 불일치
version: 0.1.0
status: draft
updated: 2026-10-19
sources:
  - UserDocs/기능 명세.md (v0.1)
  - UserDocs/v1 개발 계획.md (2026-10-19)
---

# 설계 미결 사항

기능 명세의 "미결 사항"은 모두 답이 나왔지만, 구현 단계에서 정해야 할 것들이 남아 있다.
상태: `open`(미정) · `proposed`(제안안 있음, 확인 필요) · `resolved`(결정, 관련 문서 반영됨).

| ID | 주제 | 상태 | 기한 | 관련 |
| --- | --- | --- | --- | --- |
| I-01 | 위키 링크 문법 확정 | proposed | M3 시작 전 | F-4.2, DEV-006 §5 |
| I-02 | Firebase 요금제와 무료 한도 확인 | open | M0 | N-05, ADR-0002 |
| I-03 | Drive 액세스 토큰 갱신 방식 | proposed | M0 | F-6.1, DEV-002 §3.1 |
| I-04 | AI 작업용 PDF 본문을 누가 추출하는가 | proposed | M5 | F-7.1, DEV-002 §3.3 |
| I-05 | 그래프 노드의 "사용자 닉네임" 필드 | proposed | M4 | F-3.3.1 |
| I-06 | 활성 노드 집합의 표시 위치와 동기화 여부 | open | M4 | F-3.3.2 |
| I-07 | 새 버전 알림의 "학회 채택" 감지 방법 | open | M5 | F-1.4.3 |
| I-08 | 소스 7종 중 M5에 넣을 범위 | proposed | M5 | F-1.1 |
| I-09 | 파생 문서 검색 엔진 (명세 FTS5 vs 계획 MiniSearch) | resolved | — | ADR-0004 |
| I-10 | 사용자 정의 관계 유형 목록 관리 | open | M4 | F-2.2.2 |
| I-11 | UserDocs의 임베드 다이어그램 미확인 | open | 즉시 | — |

## 상세

### I-01 위키 링크 문법

- 제안: `[[노트 제목]]`, `[[노트 제목#^blockid]]`, `[[@citeKey]]`, `[[@citeKey#ann:<id>]]`, `[[대상|별칭]]` (DEV-006 §5).
- 논점: 논문을 citeKey로 가리키면 citeKey가 바뀔 때 링크가 깨진다 → citeKey 변경 시 일괄 치환하거나, 내부적으로 `[[@work:<workId>]]`로 저장하고 에디터에서만 citeKey로 보여주는 방법 중 선택.
- 노트 제목 중복을 허용할지 (허용하면 위키 링크 해석이 모호해진다).

### I-02 Firebase 요금제와 무료 한도

- 기능 명세가 "무료 한도는 설계 시 확인"으로 남겨 두었다.
- Cloud Run, Cloud KMS, Cloud Scheduler, Secret Manager는 결제 계정이 연결된 GCP 프로젝트에서만 쓸 수 있다. 같은 프로젝트에 결제를 연결하면 Firebase도 Blaze(종량제)로 바뀌는 것으로 알고 있으나, 무료 사용량이 Blaze에서도 유지되는지 포함해 **M0에서 공식 문서로 확인**한다.
- 확인할 값: Firestore 일일 읽기/쓰기/삭제 무료량, 저장 용량, Cloud Run 무료 요청·vCPU 시간, KMS 키·연산 비용.
- 산출물: 베타 사용자 10명 기준 월 예상 비용 표를 이 문서에 추가. 예산 알림 설정.

### I-03 Drive 액세스 토큰 갱신

- Firebase `signInWithPopup`이 주는 Google 액세스 토큰은 약 1시간 후 만료되고, Firebase가 갱신해 주지 않는다.
- 제안: Google Identity Services(GIS) 토큰 클라이언트(`google.accounts.oauth2.initTokenClient`, scope `drive.file`)로 만료 시 조용히 재발급(`prompt: ''`). 처음 로그인 때만 Firebase 팝업에서 스코프 동의.
- 대안: 서버에서 refresh token 보관 (보안 부담이 커서 비추천).
- M0 스파이크로 확인: 같은 OAuth 클라이언트로 두 흐름을 쓸 때 동의 화면이 두 번 뜨지 않는지.

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

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
