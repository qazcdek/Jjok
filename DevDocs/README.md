---
doc_id: DEV-000
title: 개발 문서 안내 및 버전 관리 규칙
version: 0.1.1
status: draft
updated: 2026-10-19
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
| DEV-000 | [README.md](README.md) | 문서 안내, 버전 관리 규칙 | 0.1.1 | draft |
| DEV-001 | [01-requirements.md](01-requirements.md) | 요구사항 ID 목록, 마일스톤 추적표 | 0.1.0 | draft |
| DEV-002 | [02-architecture.md](02-architecture.md) | 시스템 구성, 실행 환경(dev/prod), 주요 흐름 | 0.4.0 | draft |
| DEV-003 | [03-data-model.md](03-data-model.md) | Firestore 스키마, 앵커·링크 모델, 드라이브 경로 | 0.2.0 | draft |
| DEV-004 | [04-security.md](04-security.md) | 인증, OAuth 스코프, 보안 규칙, BYOK 키 보관 | 0.2.0 | draft |
| DEV-005 | [05-agent-server.md](05-agent-server.md) | 백엔드 서버 API, LLM 라우팅, uv tool 계약 | 0.3.0 | draft |
| DEV-006 | [06-frontend.md](06-frontend.md) | 웹 앱 구조, 리더 어댑터, 그래프, 에디터, 검색 | 0.1.1 | draft |
| DEV-007 | [07-dev-environment.md](07-dev-environment.md) | 저장소 구조, 환경 변수, 컨벤션, CI/CD | 0.4.0 | draft |
| DEV-008 | [08-test-strategy.md](08-test-strategy.md) | 테스트 계층, 평가 데이터셋, 완료 기준 검증 | 0.1.1 | draft |
| DEV-009 | [09-open-issues.md](09-open-issues.md) | 설계 미결 사항, UserDocs와의 불일치 | 0.3.1 | draft |
| DEV-010 | [10-milestone-tasks.md](10-milestone-tasks.md) | 마일스톤별 작업 분해(WBS) | 0.5.0 | draft |
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

### 5. UserDocs와의 동기화

- 각 문서의 `sources`에 근거 UserDocs와 버전을 적는다.
- UserDocs가 바뀌면 `sources`가 그 문서를 가리키는 DevDocs를 찾아 다시 검토하고, 차이를 [09-open-issues.md](09-open-issues.md)에 적는다.

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
| 0.1.1 | 2026-10-19 | 문서 목록의 버전 갱신 |
