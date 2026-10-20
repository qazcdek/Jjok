# 아키텍처 결정 기록 (ADR)

결정 하나당 파일 하나. 결정이 바뀌면 기존 파일을 고치지 않고 새 ADR을 만들어 이전 ADR의 상태를 `superseded by ADR-XXXX`로 바꾼다.

상태: `proposed` · `accepted` · `superseded` · `deprecated`

| ADR | 제목 | 상태 | 날짜 |
| --- | --- | --- | --- |
| [ADR-0001](0001-web-app-platform.md) | 웹 앱 단일 플랫폼 | accepted | 2026-10-19 |
| [ADR-0002](0002-firebase-and-drive.md) | 저장소: Firebase(Auth·Firestore) + Google Drive(drive.file) | accepted | 2026-10-19 |
| [ADR-0003](0003-user-scoped-data.md) | 사용자 데이터는 users/{uid} 아래, 필터·그래프 계산은 클라이언트에서 | accepted | 2026-10-19 |
| [ADR-0004](0004-derived-search-in-browser.md) | 파생 문서 검색: 브라우저 MiniSearch | accepted | 2026-10-19 |
| [ADR-0005](0005-uv-tool-contract.md) | 에이전트 도구: uv tool + stdin/stdout JSON 계약 | accepted | 2026-10-19 |
| [ADR-0006](0006-annotation-anchor-model.md) | 주석 앵커: W3C Web Annotation 선택자 기반 | accepted | 2026-10-19 |
| [ADR-0007](0007-graph-library.md) | 그래프 라이브러리: Cytoscape.js | accepted | 2026-10-19 |
| [ADR-0008](0008-byok-key-storage.md) | BYOK API 키: 서버 암호화, 클라이언트 읽기 불가 | accepted | 2026-10-19 |
| [ADR-0009](0009-dev-database.md) | dev DB: SQLite 대신 Firestore 에뮬레이터 | accepted | 2026-10-19 |
| [ADR-0010](0010-tool-form-criteria.md) | 에이전트 도구 형태 선택 기준 (내장 · CLI · MCP) | accepted | 2026-10-19 |
| [ADR-0011](0011-google-analytics.md) | 웹 앱에 Google Analytics 사용 | accepted | 2026-10-19 |
| [ADR-0012](0012-backend-module-split.md) | 백엔드 서버 하나, api·agent 모듈 경계, M6에서 배포 분리 | accepted | 2026-10-20 |

## 템플릿

```markdown
# ADR-XXXX: 제목

- 상태: proposed
- 날짜: YYYY-MM-DD
- 근거: 관련 문서·요구사항 ID

## 배경
## 결정
## 결과
```
