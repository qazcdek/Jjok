---
doc_id: DEV-003
title: 데이터 모델
version: 0.3.1
status: draft
updated: 2026-10-20
sources:
  - UserDocs/기능 명세.md (v0.1) — 저장소, 버전·venue 매칭, 주석·링크 데이터 모델
  - UserDocs/v1 개발 계획.md — M0 "Firestore 스키마 v0"
---

# 데이터 모델 (Firestore 스키마 v0)

## 1. 원칙

- **사용자 데이터는 모두 `users/{uid}` 아래**에 둔다. 보안 규칙이 단순해지고 계정 삭제가 쉽다 ([ADR-0003](adr/0003-user-scoped-data.md)).
- **필터·교차·그래프 계산은 클라이언트 메모리에서** 한다. Firestore는 쿼리 하나에 `array-contains`를 하나만 허용하므로 축 교차 필터(F-2.1.3)를 쿼리로 풀 수 없다. 라이브러리 규모(수백~수천 편)에서는 전체 Work를 오프라인 캐시에 올려 두고 거르는 편이 읽기 횟수도 적다.
- 모든 문서에 `schemaVersion: number`, `createdAt`, `updatedAt`(서버 타임스탬프)을 둔다.
- ID는 Firestore 자동 ID를 쓴다. 단, 외부 식별자 기반 캐시는 정규화한 키를 문서 ID로 쓴다.
- 타입 정의 원본은 `packages/schema/`의 JSON Schema 하나이며, TS 타입과 Pydantic 모델은 여기서 생성한다 ([07-dev-environment.md](07-dev-environment.md)).

## 2. 컬렉션 구조

```
users/{uid}                          프로필, 설정
users/{uid}/works/{workId}           논문 (같은 논문의 여러 버전을 묶는 단위)
users/{uid}/works/{workId}/versions/{versionId}   버전 (arXiv v1, 학회 버전 ...)
users/{uid}/axes/{axisId}            사용자 정의 분류 축
users/{uid}/collections/{collectionId}   축 안의 컬렉션
users/{uid}/tags/{tagId}
users/{uid}/annotations/{annotationId}
users/{uid}/links/{linkId}
users/{uid}/notes/{noteId}
users/{uid}/templates/{templateId}
users/{uid}/graphViews/{viewId}
users/{uid}/notifications/{notificationId}
users/{uid}/meta/llmKeys             키 표시 정보 {provider: {last4, updatedAt}} — 서버만 쓰기
users/{uid}/apiKeys/{provider}       BYOK 암호문 — 클라이언트 읽기/쓰기 금지
citationCache/{paperKey}             인용 관계 공용 캐시 — 서버만 쓰기
```

## 3. 엔티티 정의

표기: `?`는 선택 필드. 타임스탬프는 Firestore `Timestamp`.

### 3.1 users/{uid}

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| displayName, email, photoURL | string | Google 프로필 |
| settings.theme | `"light" \| "dark" \| "system"` | F-3.4 |
| settings.citationStyle | `"apa" \| "ieee" \| "acm" \| "chicago" \| "bibtex"` | F-5.2 |
| settings.venueFilter | string[] | F-1.1.3 기본 venue 목록 |
| settings.llm.default | `{provider, model}?` | 기본 모델 |
| drive.rootFolderId? | string | `/Jjok` 폴더 ID |
| drive.filesFolderId? | string | `/Jjok/files` 폴더 ID |

### 3.2 works/{workId} — 논문 (F-1.4)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| title | string | 기본 버전 기준 |
| normTitle | string | 정규화 제목 (소문자, 기호·공백 정리) — 매칭용 |
| authors | `{name, family?, given?, s2AuthorId?}[]` | |
| year | number? | |
| venue | string? | 정규화 venue (예: `NeurIPS`) |
| primaryVersionId | string | F-1.4.1 기본 버전 |
| ids | `{doi?, arxiv?, openreview?, s2?, openalex?, dblp?}` | arXiv는 버전 접미사 제거 |
| citeKey | string | BibTeX 키 (예: `vaswani2017attention`), 사용자 안에서 유일 |
| collectionIds | string[] | 사용자 정의 축의 컬렉션 소속 (F-2.1) |
| tagIds | string[] | F-2.4 |
| abstract? | string | |

자동 축(연도·저자·venue, F-2.1.2)은 저장하지 않고 위 필드에서 계산한다.

**논문과 버전의 규칙** (F-1.4, F-1.4.1, M1-01)

- `primaryVersionId`는 항상 실제 버전을 가리킨다. 논문과 첫 버전은 한 배치로 만든다. 보안 규칙이 `existsAfter`로 검사한다.
- 버전을 추가하면 버전의 `doi`·`arxiv`·`openreview`를 논문 `ids`에 합친다. 이미 있는 값은 덮어쓰지 않는다. 논문 `ids`는 모든 버전의 식별자를 모은 것으로, 매칭(F-2.3)에 쓴다.
- 기본 버전을 바꿔도 논문의 `venue`·`year`는 바꾸지 않는다. 사용자가 arXiv 최신 버전을 기본으로 열더라도 venue 축에는 학회가 남아야 하기 때문이다.
- 기본 버전은 논문이 남아 있는 한 지울 수 없다. 앱은 기본 버전을 지울 때 남은 버전 중 새 기본 버전을 고른다 (journal > conference > workshop > preprint > other → 연도 최신 → arXiv 버전 최신). 마지막 버전을 지우면 논문도 지운다.
- 버전을 지우면 드라이브 파일도 지운다. Firestore 반영 후 지우며, 드라이브 삭제가 실패해도 데이터 삭제는 되돌리지 않는다.

### 3.3 works/{workId}/versions/{versionId} — 버전

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| kind | `"preprint" \| "workshop" \| "conference" \| "journal" \| "other"` | |
| label | string | 표시용 (예: `arXiv v2`, `ICLR 2024`) |
| ids | `{doi?, arxiv?, arxivVersion?, openreview?}` | |
| venue?, year? | string, number | |
| driveFileId? | string | PDF가 있으면 |
| fileHash? | string | SHA-256 — 중복 판정 (F-2.3) |
| fileName?, fileSize? | string, number | 업로드 원본 이름·크기 (표시용) |
| format | `"pdf" \| "markdown"` | 리더 어댑터 선택 (F-3.1) |
| pageCount? | number | |
| metadataSource | `"identifier" \| "title-search" \| "manual" \| "agent"` | N-03 평가용 |

### 3.4 axes, collections (F-2.1)

- `axes/{axisId}`: `{name, kind: "project" | "lineage" | "custom", order}`
- `collections/{collectionId}`: `{axisId, name, parentId?, order}` — 축 안에서 계층 허용

### 3.5 annotations/{annotationId} — 앵커 (F-3.2.1)

W3C Web Annotation의 selector 개념을 따른다 ([ADR-0006](adr/0006-annotation-anchor-model.md)).

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| workId, versionId | string | F-1.4.2 버전별, 논문 단위 모아보기 |
| anchor | `Anchor` | 아래 |
| color? | string | 하이라이트 색 |
| comment? | string | 주석 메모 — 파생 문서 검색 대상 (F-3.5) |
| createdBy | `"user" \| "agent"` | |
| status | `"active" \| "suggested" \| "dismissed"` | AI 제안 주석(F-7.2)은 `suggested`로 시작 |

```ts
type Anchor =
  | { type: "document" }
  | { type: "page"; page: number }
  | { type: "text"; page?: number;
      quote: { exact: string; prefix: string; suffix: string };   // TextQuoteSelector
      position?: { start: number; end: number } }                 // TextPositionSelector (보조)
  | { type: "region"; page: number;
      rect: { x: number; y: number; w: number; h: number } };     // 페이지 기준 0~1 정규화 좌표
```

- `text` 앵커는 PDF와 Markdown 모두에 쓴다. 복원 시 quote 우선, position은 힌트.
- `region` 좌표는 렌더링 배율과 무관하게 페이지 크기 대비 비율로 저장한다.

### 3.6 links/{linkId} — 링크 (F-3.2.2, F-3.2.3, F-2.2.2)

```ts
type Ref =
  | { kind: "annotation"; id: string; workId: string }
  | { kind: "work"; id: string }
  | { kind: "version"; id: string; workId: string }
  | { kind: "note"; id: string }
  | { kind: "noteBlock"; id: string; blockId: string }   // 노트의 특정 문단
  | { kind: "url"; url: string };
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| from | Ref | 보통 annotation |
| to | Ref | |
| fromKey, toKey | string | 조회용 직렬화 키: `annotation:<id>`, `work:<id>`, `noteBlock:<id>#<blockId>`, `url:<sha1>` |
| fromWorkId?, toWorkId? | string | 계보 그래프 계산용 비정규화 |
| type | string | `"related"`(기본) 또는 사용자 정의 관계: `extends`, `refutes`, `reproduces` … |
| createdBy | `"user" \| "agent"` | |
| status | `"active" \| "suggested" \| "dismissed"` | F-7.4 관계 제안 |

- 백링크: `where("toKey", "==", key)`. 정방향: `where("fromKey", "==", key)`.
- 위키 링크로 생긴 노트→노트 / 노트→논문 연결은 links에 **저장하지 않고** 노트 본문에서 파싱한다 (본문이 진실 원천). 대신 `notes.outLinks`에 파싱 결과를 캐시한다.

### 3.7 notes/{noteId} (F-4)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| title | string | 사용자 안에서 유일 권장 (위키 링크 해석) |
| body | string | Markdown. Firestore 문서 1 MiB 한도 → 본문 500 KB 초과 시 경고 |
| kind | `"user" \| "ai_summary" \| "ai_keywords" \| "ai_qa"` | F-4.6 |
| templateId? | string | |
| workIds | string[] | 노트–논문 다대다 (F-4.3) |
| outLinks | `{notes: string[], works: string[], annotations: string[]}` | 본문 파싱 캐시, 저장 시 갱신 |
| aiMeta? | `{provider, model, task, sourceVersionId?, createdAt}` | AI 문서 출처 |

문단 앵커(`noteBlock`)용 blockId는 Markdown 문단 끝의 `^blockid` 표기로 둔다 (문법은 [09-open-issues.md I-01](09-open-issues.md)).

### 3.8 templates, graphViews, notifications

- `templates/{id}`: `{name, body, isDefault: boolean}` — 기본 "리뷰 노트", "실험 노트"는 첫 로그인 시 생성 (F-4.5)
- `graphViews/{id}` (F-2.2.3):
  ```ts
  { name: string;
    scope: "works" | "notes";
    edgeCriteria: ("citation" | "coauthor" | "venue" | "sharedNote" | `relation:${string}` | "wikilink")[];
    filters: { collectionIds?: string[]; tagIds?: string[]; yearFrom?: number; yearTo?: number; venues?: string[] };
    showGhostNodes: boolean;          // 라이브러리 밖 인용 논문
    layout: "cose" | "breadthfirst" | "concentric" | string;
    positions?: Record<string, {x: number; y: number}>; }
  ```
- `notifications/{id}`: `{type: "new_version" | "accepted", workId, payload, read: boolean}` (F-1.4.3)

### 3.9 apiKeys/{provider} (F-7.7)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| ciphertext | bytes | KMS(또는 envelope) 암호문 |
| kmsKeyVersion | string | 키 회전 대비 |
| updatedAt | Timestamp | |

클라이언트 읽기·쓰기 모두 금지. 서버 Admin SDK만 접근. 화면 표시용 마지막 4자리는 `meta/llmKeys`에 따로 둔다 ([04-security.md](04-security.md)).

### 3.10 citationCache/{paperKey} (F-2.2.1)

- `paperKey`: `s2:<paperId>` 우선, 없으면 `oa:<openalexId>`.
- 필드: `{ids: {...}, title, year, references: PaperRef[], citedBy: PaperRef[], citedByCount, lastFetchedAt, source}`
- `citedBy`가 큰 논문은 상위 N개(예: 1,000)만 저장하고 `truncated: true` 표시. 1 MiB 한도 주의.
- 공개 메타데이터이므로 사용자 간 공유. 인증된 사용자 읽기 허용, 쓰기는 서버만.

## 4. 드라이브 구조 (F-6.2)

```
/Jjok/
  files/
    <workId>/
      <versionId>.pdf
```

- 폴더 ID는 `users/{uid}.drive`에 캐시. 사용자가 폴더를 지우면 재생성.
- `drive.file` 스코프에서는 앱이 만든 파일만 보인다. 사용자가 직접 드라이브에 넣은 PDF는 보이지 않는다 (업로드는 앱을 통해서만).

## 5. 인덱스

- `links`: `toKey ASC`, `fromKey ASC` (단일 필드, 자동)
- `annotations`: `(workId, versionId)` 복합
- `notes`: `workIds array-contains` + `updatedAt DESC` 복합
- 정의 파일: `firebase/firestore.indexes.json`

## 6. 스키마 버전과 마이그레이션

- 문서별 `schemaVersion`. 클라이언트는 읽을 때 구버전이면 메모리에서 업그레이드하고, 쓸 때 최신 버전으로 저장한다 (lazy migration).
- 필드 삭제·이름 변경은 MAJOR 변경 → 이 문서 MAJOR 버전 올림 + 마이그레이션 스크립트(`services/api/migrations/`).

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 (스키마 v0) |
| 0.1.1 | 2026-10-19 | 드라이브 폴더 이름 /Jjok 확정 |
| 0.2.0 | 2026-10-19 | Version 에 fileName·fileSize 추가 (M0 구현), 스키마 원본 packages/schema 와 일치 |
| 0.3.0 | 2026-10-20 | 작품과 판의 규칙 (대표 버전 무결성, 식별자 합치기, 삭제 시 대표 재선택) |
| 0.3.1 | 2026-10-20 | 용어 교체: 작품 → 논문, 판 → 버전, 대표 버전 → 기본 버전 (DEV-011, H-003) |
