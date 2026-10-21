---
doc_id: DEV-000
title: 개발 문서 안내 및 버전 관리 규칙
version: 0.3.0
status: draft
updated: 2026-10-21
sources:
  - UserDocs/기능 명세.md (v0.1, 2026-10-19)
  - UserDocs/v1 개발 계획.md (2026-10-19)
---

# 개발 문서 (DevDocs)

`UserDocs/`가 **무엇을 왜** 만드는지(제품 관점)를 다룬다면, `DevDocs/`는 **어떻게** 만드는지(구현 관점)를 다룬다.
UserDocs와 DevDocs가 충돌하면 UserDocs가 우선이며, 충돌은 [09-open-issues.md](09-open-issues.md)에 기록하고 해소한다.

## 문서 목록

| ID | 문서 | 내용 | 버전 | 상태 |
| --- | --- | --- | --- | --- |
| DEV-000 | [README.md](README.md) | 문서 안내, 버전 관리 규칙, 작업 ID | 0.3.0 | draft |
| DEV-001 | [01-requirements.md](01-requirements.md) | 요구사항 ID 목록, 마일스톤 추적표 | 0.1.3 | draft |
| DEV-002 | [02-architecture.md](02-architecture.md) | 시스템 구성, 실행 환경(dev/prod), 주요 흐름 | 0.4.5 | draft |
| DEV-003 | [03-data-model.md](03-data-model.md) | Firestore 스키마, 앵커·링크 모델, 드라이브 경로 | 0.4.1 | draft |
| DEV-004 | [04-security.md](04-security.md) | 인증, OAuth 스코프, 보안 규칙, BYOK 키 보관 | 0.3.2 | draft |
| DEV-005 | [05-agent-server.md](05-agent-server.md) | 백엔드 서버 API, LLM 라우팅, uv tool 계약 | 0.4.1 | draft |
| DEV-006 | [06-frontend.md](06-frontend.md) | 웹 앱 구조, 리더 어댑터, 그래프, 에디터, 검색 | 0.1.4 | draft |
| DEV-007 | [07-dev-environment.md](07-dev-environment.md) | 저장소 구조, 환경 변수, 컨벤션, CI/CD | 0.4.3 | draft |
| DEV-008 | [08-test-strategy.md](08-test-strategy.md) | 테스트 계층, 평가 데이터셋, 완료 기준 검증 | 0.2.5 | draft |
| DEV-009 | [09-open-issues.md](09-open-issues.md) | 설계 미결 사항, UserDocs와의 불일치, 발견된 문제 | 0.4.5 | draft |
| DEV-010 | [10-milestone-tasks.md](10-milestone-tasks.md) | 마일스톤별 작업 분해(WBS), 마일스톤 밖 작업(H) | 0.8.0 | draft |
| DEV-011 | [11-glossary.md](11-glossary.md) | 용어집: 화면 용어 ↔ 코드 이름 | 1.0.1 | approved |
| ADR | [adr/](adr/README.md) | 아키텍처 결정 기록 | — | — |
| — | [CHANGELOG.md](CHANGELOG.md) | DevDocs 전체 변경 이력 | — | — |

## 버전 관리 규칙

### 1. 문서 머리말(front matter)

모든 문서는 맨 위에 YAML 머리말을 둔다.

```yaml
doc_id: DEV-003          # 고정 ID. 파일 이름이 바뀌어도 유지한다
title: 데이터 모델
version: 0.2.0           # 아래 규칙에 따른 문서 버전
status: draft            # draft | review | approved | deprecated
updated: 2026-11-02      # 마지막 수정일 (YYYY-MM-DD)
sources:                 # 근거가 된 UserDocs와 그 버전
  - UserDocs/기능 명세.md (v0.1)
```

### 2. 문서 버전 번호 (MAJOR.MINOR.PATCH)

| 올리는 자리 | 언제 | 예 |
| --- | --- | --- |
| MAJOR | 이미 구현된 계약을 깨는 변경 (스키마 필드 삭제·이름 변경, API 응답 형식 변경, 도구 계약 변경) | 1.4.0 → 2.0.0 |
| MINOR | 내용 추가, 호환되는 변경 (새 컬렉션·필드·엔드포인트, 새 섹션) | 0.1.0 → 0.2.0 |
| PATCH | 오탈자, 표현 수정, 링크 수정 등 의미 변화 없음 | 0.2.0 → 0.2.1 |

- 구현 착수 전 초안은 `0.x`로 둔다. 해당 문서가 다루는 첫 마일스톤을 시작할 때 검토 후 `1.0.0 / approved`로 올린다.
- `approved` 문서를 바꾸려면 버전을 올리고, 영향받는 코드 작업을 [10-milestone-tasks.md](10-milestone-tasks.md)에 추가한다.

### 3. 변경 이력 기록

- 각 문서 맨 아래 `## 변경 이력` 표에 한 줄을 추가한다.
- 같은 내용을 [CHANGELOG.md](CHANGELOG.md)에도 한 줄 요약으로 남긴다.
- 설계 결정이 바뀌면 문서만 고치지 말고 새 ADR을 만들어 이전 ADR을 `superseded`로 표시한다.

### 4. Git 운용

- 저장소 루트에서 git으로 관리한다. 문서 변경 커밋 메시지는 `docs(DEV-003): Note 컬렉션에 templateId 추가` 형식.
- 문서 묶음 단위로 태그를 붙인다: 버전 스냅샷은 `devdocs-v0.1.0`, 마일스톤 시작 시점은 `devdocs-M0`, `devdocs-M1`, …
- 코드와 문서가 같이 바뀌는 변경(예: 스키마 변경)은 같은 커밋 또는 같은 PR에 넣는다.

### 5. 작업 ID: 태스크(T), 마일스톤 밖 작업(H), 문제(I)

| 종류 | ID | 언제 | 완료 기록 | 커밋 · PR 표기 |
| --- | --- | --- | --- | --- |
| 태스크 | `M<마일스톤>-T<번호>` (예: `M1-T4`) | DEV-010 WBS에 있는 마일스톤 안의 작업 | DEV-010 "M<n> 진행 현황" 표 | `[M1-T4]` |
| 마일스톤 밖 작업 | `H-<번호>` (예: `H-3`) | WBS에 없는 요청·수정: 사용자 요청 변경, 진행 중 발견한 버그 수정, 개발 환경 정리 | DEV-010 "마일스톤 밖 작업 (H)" 표 | `[H-3]` |
| 미결·발견 문제 | `I-<번호>` (예: `I-15`) | 결정이 필요하거나 아직 고치지 않은 문제. 출처(태스크 또는 H)를 `관련`에 적는다 | DEV-009 | 해결 커밋에 `[I-15]` |

- 번호는 자릿수를 고정하지 않는다 (앞에 0을 붙이지 않음): `M1-T5`, `M1-T12`, `H-4`. 정확히 찾을 때는 대괄호까지 검색한다 (`[M1-T1]`은 `[M1-T12]`에 걸리지 않음).
- 태스크 번호는 마일스톤마다 0 또는 1부터 매긴다. 브랜치 이름도 같은 ID를 쓴다: `feat/M1-T5-metadata-confirm`, `chore/H-4-id-format`.
- 옛 형식: 2026-10-21 이전의 커밋 메시지·PR 제목·브랜치 이름은 `M1-04`, `H-003`처럼 0을 채운 형식이다. `M1-04` = `M1-T4`, `H-003` = `H-3`. 문서는 새 형식으로 고쳤다 (H-4).

- H 번호는 마일스톤과 무관하게 전체에서 하나씩 늘린다. 유형은 `fix`(버그) · `change`(요청에 따른 변경) · `chore`(환경·도구)로 적는다.
- H 작업이 태스크의 범위·견적을 바꾸면 해당 태스크 메모에도 `H-<번호> 반영`을 적는다.
- H 작업이 마일스톤 하나의 일부가 될 만큼 크면 (반나절 이상) WBS에 태스크로 올린다. 예: M1-T0 은 요청으로 시작했지만 M1 태스크로 올렸다.
- 바로 고치지 않는 문제는 H로 만들지 않고 I로 남긴다. 나중에 고칠 때 그 작업이 H 또는 M이 된다.

### 6. UserDocs와의 동기화

- 각 문서의 `sources`에 근거 UserDocs와 버전을 적는다.
- UserDocs가 바뀌면 `sources`가 그 문서를 가리키는 DevDocs를 찾아 다시 검토하고, 차이를 [09-open-issues.md](09-open-issues.md)에 적는다.

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
| 0.1.1 | 2026-10-19 | 문서 목록의 버전 갱신 |
| 0.2.0 | 2026-10-20 | 작업 ID 규칙(M · H · I) 추가, DEV-011 용어집 |
| 0.3.0 | 2026-10-21 | 작업 ID 형식 변경: 태스크 `M1-T4`, `H-3` (자릿수 고정 없음), 옛 형식 대응 (H-4) |
