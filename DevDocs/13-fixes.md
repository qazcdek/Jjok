---
doc_id: DEV-013
title: 고칠 것
version: 0.1.0
status: draft
updated: 2026-10-20
sources:
  - DevDocs/12-done.md (0.1.0)
---

# 고칠 것

끝난 작업([DEV-012](12-done.md))에서 나온 버그, 확인이 덜 된 부분, 임시로 피해 간 것.
아직 안 한 작업은 [DEV-011](11-todo.md), 설계 결정이 필요한 것은 [DEV-009](09-open-issues.md)에 둔다.

- ID: `FX-<번호>`. 커밋·PR 에서 `[FX-01]`처럼 참조한다. 번호는 다시 쓰지 않는다.
- 심각도: `높음`(데이터 손상·보안·주요 흐름 실패) · `중간`(특정 조건에서 틀림) · `낮음`(불편, 관찰).
- 상태: `open` · `진행 중` · `fixed`(커밋 적음) · `보류`(이유 적음).
- 언제까지: 이 작업 전에 고쳐야 한다는 뜻.

| ID | 내용 | 나온 곳 | 심각도 | 상태 | 언제까지 |
| --- | --- | --- | --- | --- | --- |
| FX-01 | Drive 업로드 뒤 Firestore 쓰기가 실패하면 Drive 에 연결 안 된 파일이 남는다 | M0-07, M1-04 | 중간 | open | M1-02 |
| FX-02 | citeKey 중복 확인과 저장 사이에 틈이 있어 동시에 올리면 같은 citeKey 가 생긴다 | M1-11 | 중간 | open | M1-02 |
| FX-03 | 5 MB 넘는 PDF(resumable 업로드)를 실제 Drive 에서 확인하지 않았다 | M0-07 | 중간 | open | M1-12 |
| FX-04 | E2E 에뮬레이터 로그인 팝업에서 첫 클릭이 무시되어 재시도로 피해 갔다. 원인 모름 | M0-11 | 낮음 | 보류 | — |
| FX-05 | 브라우저에 Google 계정이 여럿이면 다른 계정 토큰이 올 수 있는지 확인 못 함 | M0-06 | 낮음 | open | 베타 |
| FX-06 | 에이전트 서버가 꺼져 있으면 제목이 파일 이름으로 남고 "확인 필요"만 붙는다. 다시 조회할 방법이 없다 | M1-04 | 중간 | open | M1 완료 |
| FX-07 | OpenAlex 의 arXiv 논문 기록이 부정확하다 (Attention 이 2025년, 엉뚱한 DOI) | M1-04 | 낮음 | open | M1-12 |
| FX-08 | OpenReview API 가 봇 확인(403 `ChallengeRequiredError`)으로 막힌다 | M1-04, M1-06 | 중간 | 보류 | M5-02 |

## 상세

### FX-01 Drive 고아 파일

- `apps/web/src/features/library/uploads.ts` `uploadPdf`: Drive 업로드 → Firestore batch 순서. batch 가 실패하면 Drive 파일만 남는다.
- 안: batch 실패 시 Drive 파일 삭제를 시도한다. 그래도 남는 파일은 나중에 "정리" 작업(Drive 목록과 Version 대조)으로 지운다.

### FX-02 citeKey 경합

- `freeCiteKey` 가 범위 조회로 쓰인 키를 확인한 뒤 batch 로 쓴다. 한 사람이 여러 파일을 한꺼번에 올리면 둘 다 같은 키를 볼 수 있다.
- 안 1: 업로드 큐에서 citeKey 결정만 차례로 한다 (간단, 한 기기 안에서만 막힘).
- 안 2: `citeKeys/{key}` 예약 문서를 트랜잭션으로 만든다 (기기 간에도 막힘, 보안 규칙 목록에 컬렉션 추가 필요).
- M1-02(여러 파일 업로드)부터 실제로 생기므로 그 전에 고친다.

### FX-03 resumable 업로드 실제 확인

- 단위 테스트(MemoryDrive·모의 fetch)만 있다. 논문 PDF 는 5 MB 를 넘는 경우가 흔하므로 평가셋(M1-12)을 올릴 때 함께 확인한다.

### FX-04 E2E 첫 클릭

- PR #2 에서 "Add new account" 를 계정 입력 화면이 뜰 때까지 다시 누르게 했다. CI 에서만 생긴다. 다시 흔들리면 원인을 본다.

### FX-05 여러 계정

- DEV-009 I-03 의 남은 관찰. 생기면 GIS 요청에 `prompt: 'select_account'` 또는 `login_hint` 확인을 넣는다.

### FX-06 다시 조회

- 지금은 자동 채움이 실패하면 사용자가 고칠 화면이 없다. M1-05 확인 UI 에 "다시 조회"를 넣고, `metadataSource: manual` 인 Work 를 목록에서 걸러 볼 수 있게 한다.

### FX-07 OpenAlex arXiv 기록

- arXiv ID 가 있으면 arXiv API 를 먼저 쓰므로 영향은 제목 검색으로 찾을 때뿐이다. 평가셋에서 틀리는 비율을 보고, 높으면 OpenAlex 결과 중 `preprint` 는 arXiv API 로 다시 확인한다.

### FX-08 OpenReview 차단

- `api2.openreview.net` 이 서버·스크립트 요청에 봇 확인을 요구한다. 로그인 토큰을 쓰는 방법, 공개 노트 페이지를 읽는 방법을 M5-02 에서 확인한다. 그때까지 OpenReview ID 는 추출만 하고 조회는 하지 않는다.

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-20 | 최초 작성 (FX-01 ~ FX-08) |
