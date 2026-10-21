---
doc_id: DEV-006
title: 웹 프론트엔드 설계
version: 0.1.4
status: draft
updated: 2026-10-21
sources:
  - UserDocs/기능 명세.md (v0.1) — 3. 읽기와 하이라이트, 4. 노트, 리더와 그래프, 노트 검색
  - UserDocs/v1 개발 계획.md — 기술 스택 제안
---

# 웹 프론트엔드

React + TypeScript + Vite SPA. 위치: `apps/web/`.

## 1. 라이브러리 선택

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 라우팅 | React Router | |
| 서버 상태 | Firestore 구독을 감싼 훅 (`useCollection`, `useDoc`) | 실시간 동기화가 곧 상태 |
| 클라이언트 상태 | Zustand | 핀 꽂은 논문 목록, 현재 리더 대상, UI 상태 |
| 스타일 | CSS 변수 기반 라이트/다크 토큰 (+ 선택: Tailwind) | F-3.4 |
| PDF | pdf.js (`pdfjs-dist`) | 텍스트 레이어로 앵커 구현 |
| 에디터 | CodeMirror 6 + `@codemirror/lang-markdown` | 위키 링크 자동완성 확장 |
| Markdown 렌더 | unified (remark/rehype) + 위키 링크 플러그인 | 리더 Markdown 어댑터와 공유 (F-4.1) |
| 그래프 | Cytoscape.js | [ADR-0007](adr/0007-graph-library.md) |
| 검색 | MiniSearch | [ADR-0004](adr/0004-derived-search-in-browser.md) |
| 인용 포맷 | citation-js (CSL: APA, IEEE, ACM, Chicago) | F-5.1 |
| 테스트 | Vitest, Testing Library, Playwright | [08-test-strategy.md](08-test-strategy.md) |

## 2. 디렉터리 구조

```
apps/web/src/
  app/              라우터, 레이아웃, 테마
  lib/
    firebase/       초기화, 인증, Firestore 훅, 오프라인 캐시 설정
    drive/          Drive 클라이언트 (폴더 생성, 업로드, 다운로드, 토큰 갱신)
    api/            백엔드 서버 클라이언트 (fetch + SSE). 기준 URL `VITE_API_BASE_URL`
    schema/         packages/schema 에서 생성된 타입 (수정 금지)
  features/
    library/        목록, 분류 기준·컬렉션, 태그, 교차 필터, 업로드, 식별자 추가
    works/          논문·버전 상세, 기본 버전, 병합 UI
    reader/         리더 셸 + 포맷 어댑터
      adapters/pdf/
      adapters/markdown/   (v1 이후)
    annotations/    앵커 생성·복원, 링크 생성, 백링크 패널
    notes/          에디터, 위키 링크, 템플릿, 노트 그래프
    graph/          논문 그래프, 연결 기준, 저장한 그래프, 핀 꽂은 논문으로 이동
    search/         노트 검색 인덱스와 검색 UI
    ai/             모델 선택, 키 관리 화면, 작업 실행 패널
    citations/      스타일 포맷, 빠른 복사, BibTeX 내보내기
```

## 3. 화면 구성

```
┌─────────────┬───────────────────────────────┬──────────────────┐
│ 사이드바     │  메인 영역                     │ 우측 패널         │
│ - 분류 기준/컬렉션  │  [라이브러리 목록]              │ - 백링크          │
│ - 태그       │   또는 [리더]                  │ - 연결된 노트     │
│ - 저장한 그래프  │   또는 [노트 에디터]            │ - AI 작업         │
│ - 노트       │   또는 [그래프]                │ - 메타데이터      │
├─────────────┴───────────────────────────────┴──────────────────┤
│ 핀 꽂은 논문 바 (탭 대체: 핀 꽂은 논문 목록, 클릭 시 리더 전환)            │
└─────────────────────────────────────────────────────────────────┘
```

> 핀 꽂은 논문을 그래프 안에서만 보여줄지, 하단 바로도 보여줄지는 [09-open-issues.md I-06](09-open-issues.md).

## 4. 리더 어댑터 (F-3.1)

```ts
interface ReaderAdapter {
  format: "pdf" | "markdown";
  load(source: Blob | string): Promise<DocumentHandle>;
  render(container: HTMLElement, opts: { page?: number; theme: Theme }): void;
  getText(range?: { fromPage?: number; toPage?: number }): Promise<string>;   // AI 작업용
  /** 현재 선택 → Anchor (03-data-model §3.5) */
  selectionToAnchor(sel: Selection | RegionSelection): Anchor | null;
  /** Anchor → 화면 위치. 복원 실패 시 null (위치를 잃은 하이라이트로 표시) */
  resolveAnchor(anchor: Anchor): Promise<ResolvedRange | null>;
  scrollTo(anchor: Anchor): void;
}
```

- PDF 텍스트 앵커 복원: 페이지 텍스트 레이어에서 `exact`를 찾고, 여러 개면 `prefix/suffix`로 결정. 실패 시 퍼지 매칭(diff-match-patch 등).
- 영역 앵커: 오버레이 레이어에 정규화 좌표로 사각형 표시.
- 다크 모드에서 PDF 페이지는 CSS 필터 반전 옵션을 둔다 (기본 꺼짐).
- **M2 시작 전 스파이크 (2일)**: Markdown 문서로도 같은 Anchor 타입이 동작하는지 확인 (개발 계획 리스크 5).

## 5. 노트 (F-4)

- 위키 링크 문법 초안 ([09-open-issues.md I-01](09-open-issues.md)에서 확정):

  | 문법 | 대상 |
  | --- | --- |
  | `[[노트 제목]]` | 노트 |
  | `[[노트 제목#^blockid]]` | 노트의 문단 |
  | `[[@citeKey]]` | 논문 (Work) |
  | `[[@citeKey#ann:<annotationId>]]` | 논문의 하이라이트 |
  | `[[노트 제목\|표시 텍스트]]` | 별칭 |

- CodeMirror 확장: `[[` 입력 시 노트 제목, `[[@` 입력 시 citeKey 자동완성. 깨진 링크는 다른 색으로 표시하고 클릭 시 새 노트 생성.
- 저장 시 본문을 파싱해 `outLinks`, `workIds` 갱신 (03-data-model §3.7). 저장은 디바운스(1초) + 페이지 이탈 시 즉시.
- 동시 편집 충돌: Firestore 마지막 쓰기 우선. 다른 기기에서 바뀐 경우 "다른 기기에서 수정됨" 안내 후 새로고침 (v1은 병합 편집 없음).
- 노트 제목 변경 시 이 노트를 가리키는 다른 노트의 위키 링크를 일괄 수정할지 묻는다.

## 6. 그래프 (F-2.2, F-3.3, F-4.4)

### 엣지 계산 (클라이언트)

| 기준 | 계산 |
| --- | --- |
| citation | 라이브러리 Work의 `ids.s2` → `citationCache.references` 교차 |
| coauthor | 저자 이름 정규화(또는 s2AuthorId) 교집합 ≥ 1 |
| venue | `venue` 같음 (+ 선택: 같은 연도) |
| sharedNote | 같은 노트의 `workIds`에 함께 포함 |
| relation:* | `links` 중 `fromWorkId`/`toWorkId`가 있고 type이 일치, status=active |
| wikilink (노트 그래프) | `notes.outLinks.notes` |

- 계산 결과는 메모이즈하고 Web Worker로 분리 (노드 수천 개 대비).
- 노드 수가 수천을 넘어 Cytoscape가 느려지면 Sigma.js 전환을 검토 (ADR-0007).

### 핀 꽂은 논문으로 이동

- 상태: `pinnedWorkIds: string[]`(순서 = 최근에 핀 꽂은 순), `currentReaderTarget: {workId, versionId}`.
- 핀 꽂은 논문은 라벨(제목 또는 사용자 별칭) 표시, 핀을 꽂지 않은 논문은 라벨 없는 점.
- 핀 꽂은 논문 클릭 → 리더 전환. 리더는 항상 하나만 연다.
- 핀 꽂은 논문 목록은 기기별 UI 상태로 보고 localStorage에 저장한다 (Firestore 동기화 여부는 I-06).
- "사용자 별칭": Work에 `nickname?: string` 필드 추가 필요 → 데이터 모델 0.2.0에서 반영 예정 (I-05).

## 7. 노트 검색 (F-3.5, F-4.7)

- 인덱스 대상: 노트(`title`, `body`), AI 노트(노트 kind=`ai_*`), 하이라이트 `comment`, Work `title`/`abstract`/키워드.
- 앱 시작 시 Firestore 캐시에서 인덱스를 만들고, 구독 변경분으로 증분 갱신. 인덱스는 IndexedDB에 직렬화해 다음 실행 속도를 높인다 (동기화 대상 아님).
- 한국어 토크나이저: 기본 공백 분리 + 2-gram 보조 인덱스 (한국어 조사 처리) — M3에서 검증.
- 결과 가중치: 노트 > AI 노트 > 하이라이트 > 메타데이터.

## 8. Drive 클라이언트

- 업로드: multipart 업로드 (파일 ≤ 5 MB), 그 이상은 resumable 업로드.
- 다운로드한 PDF는 IndexedDB(또는 Cache Storage)에 캐시, 용량 상한(예: 500 MB) LRU.
- 액세스 토큰 만료(401) 시 토큰 갱신 후 1회 재시도.

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
| 0.1.1 | 2026-10-20 | 백엔드 서버 클라이언트 경로 `lib/api` |
| 0.1.2 | 2026-10-20 | 용어 교체: 작품 → 논문, 판 → 버전, 대표 버전 → 기본 버전 (DEV-011, H-3) |
| 0.1.3 | 2026-10-20 | 용어 확정 반영: 분류 기준, 하이라이트·메모, 논문 그래프, 핀 꽂은 논문, 노트 검색, 검색 사이트, 백엔드 서버 등 (DEV-011 1.0.0, H-3) |
| 0.1.4 | 2026-10-21 | 작업 ID 표기 변경: `M1-04` → `M1-T4`, `H-003` → `H-3` (H-4). 내용 변화 없음 |
