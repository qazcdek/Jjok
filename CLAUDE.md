# Jjok 작업 규약

이 저장소에서 일하는 에이전트(Claude Code 등)와 사람이 **문서를 어떻게 찾고 읽고 고치는지** 정한 최상위 규약이다.
세부 규칙은 각 문서에 있고, 이 파일은 그 위치만 가리킨다. 같은 규칙을 여기에 다시 쓰지 않는다.

## 1. 문서 계층

모든 문서는 상위 색인 하나에 링크되어 있다. 고아 문서는 없다 (규칙: [DevDocs/README.md §7](DevDocs/README.md#7-문서-계층)).

```
README.md                         저장소 입구 (사람용 빠른 시작)
├── CLAUDE.md                     이 파일: 문서 읽기·쓰기 규약
├── UserDocs/README.md            제품 문서 색인 (무엇을 왜)
│   ├── 기능 명세.md
│   └── v1 개발 계획.md
├── DevDocs/README.md             개발 문서 색인 DEV-000 (어떻게): 버전 규칙, 작업 ID
│   ├── 01-requirements.md … 11-glossary.md   DEV-001 ~ DEV-011
│   ├── CHANGELOG.md
│   └── adr/README.md             결정 기록 색인
│       └── 0001-… ~ 0012-…
└── tools/_template/README.md     새 도구 템플릿
```

## 2. 무엇이 우선인가

UserDocs > DevDocs의 accepted ADR > DevDocs 문서 > 코드 주석. 서로 다르면 위를 따르고, 차이를 [DEV-009](DevDocs/09-open-issues.md)에 적는다.

## 3. 읽는 순서

작업을 시작할 때는 아래 순서로 읽는다. 문서 전체가 아니라 색인 표를 보고 필요한 절만 읽는다.

1. 이 파일
2. [DevDocs/README.md](DevDocs/README.md): 문서 목록, 버전 규칙, 작업 ID(§5)
3. [DEV-010](DevDocs/10-milestone-tasks.md): 지금 마일스톤의 태스크 표와 "진행 현황"
4. [DEV-009](DevDocs/09-open-issues.md): 이 작업과 관련된 열린 이슈
5. 작업 종류에 맞는 문서:

| 작업                           | 먼저 볼 문서                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 화면 문구, 이름 짓기           | [DEV-011 용어집](DevDocs/11-glossary.md)                                                                                                        |
| 요구사항 확인                  | [UserDocs/기능 명세.md](UserDocs/기능%20명세.md), [DEV-001](DevDocs/01-requirements.md)                                                         |
| 흐름 (업로드, 요약, 인용 수집) | [DEV-002](DevDocs/02-architecture.md) §3                                                                                                        |
| Firestore 문서·필드            | [DEV-003](DevDocs/03-data-model.md), `packages/schema/schemas/`                                                                                 |
| 인증, 보안 규칙, 키            | [DEV-004](DevDocs/04-security.md), `firebase/firestore.rules`                                                                                   |
| 백엔드 서버, 도구              | [DEV-005](DevDocs/05-agent-server.md), [ADR-0010](DevDocs/adr/0010-tool-form-criteria.md), [ADR-0012](DevDocs/adr/0012-backend-module-split.md) |
| 웹 앱 구조                     | [DEV-006](DevDocs/06-frontend.md)                                                                                                               |
| 로컬 실행, 환경 변수, CI       | [DEV-007](DevDocs/07-dev-environment.md)                                                                                                        |
| 테스트                         | [DEV-008](DevDocs/08-test-strategy.md)                                                                                                          |

## 4. 쓰는 규칙

- 새 문서는 상위 색인에 링크하고 나서 만든 것으로 친다. `pnpm docs:check`가 고아 문서, 깨진 링크, 색인과 머리말의 버전 차이를 잡는다.
- DevDocs를 고치면 머리말 version, 문서 끝 변경 이력, [CHANGELOG](DevDocs/CHANGELOG.md), DevDocs/README 목록 버전을 함께 고친다 ([DEV-000 §1~3](DevDocs/README.md#버전-관리-규칙)).
- 결정이 바뀌면 ADR을 고치지 않고 새 ADR을 쓴다 ([adr/README.md](DevDocs/adr/README.md)).
- UserDocs는 사용자 문서다. 사용자가 요청할 때만 고친다.

## 5. 작업 진행

- 작업 ID, 커밋 태그, 브랜치 이름: [DEV-000 §5](DevDocs/README.md#5-작업-id-태스크t-마일스톤-밖-작업h-문제i). 태스크 `M1-T5`, 마일스톤 밖 작업 `H-5`, 문제 `I-18`.
- 태스크를 끝내면 DEV-010 진행 현황, 바뀐 설계 문서, 테스트를 같은 PR에 넣는다.
- PR은 태스크마다 하나. 앞 PR에 쌓은 PR은 앞 PR이 머지된 뒤 base가 `main`으로 바뀌었는지 확인한다 (2026-10-21: #6·#7이 main이 아닌 앞 브랜치에 머지됨).
- 커밋·push·PR은 사용자가 요청할 때만 한다.

## 6. 비밀과 개인정보

- `.env`, `.env.*.local`은 덮어쓰지 않는다. 고칠 때는 해당 줄만 바꾸고, 키 값은 출력하지 않는다.
- 사용자 이메일은 외부 서비스로 보내지 않는다 (예: Crossref `mailto`).
- 외부 API 응답을 테스트 픽스처로 저장할 때는 키가 들어가지 않았는지 확인한다.

## 7. 실행과 검사

- 실행 모드 두 가지: 에뮬레이터(`pnpm dev:web`, `http://127.0.0.1:5173`)와 dev 프로젝트(`pnpm dev:cloud`, `http://localhost:5173`). 모드를 바꿀 때는 사용자에게 먼저 말한다 ([DEV-007 §3](DevDocs/07-dev-environment.md#3-로컬-실행)).
- 검사: `pnpm docs:check`, `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm rules:test`, `pnpm e2e`, `(cd services/api && uv run ruff check . && uv run pyright && uv run pytest)`.
