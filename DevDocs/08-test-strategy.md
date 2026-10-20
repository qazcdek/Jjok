---
doc_id: DEV-008
title: 테스트 전략
version: 0.2.3
status: draft
updated: 2026-10-20
sources:
  - UserDocs/v1 개발 계획.md — 마일스톤별 완료 기준, 리스크
---

# 테스트 전략

## 1. 테스트 계층

| 계층 | 도구 | 대상 | CI |
| --- | --- | --- | --- |
| 단위 (웹) | Vitest | 앵커 직렬화·복원, 위키 링크 파서, 엣지 계산, 인용 포맷, 필터 로직 | 모든 PR |
| 컴포넌트 | Vitest + Testing Library | 에디터 자동완성, 필터 UI, 키 관리 화면 | 모든 PR |
| 보안 규칙 | `@firebase/rules-unit-testing` + 에뮬레이터 | 04-security §2 전체 | `firebase/**` 변경 시 |
| 단위 (서버) | pytest | LLM 라우팅, 키 암복호화, 마스킹, 매칭 규칙 | 모든 PR |
| 도구 계약 | pytest | 각 uv tool: `--schema` 유효성, 골든 입출력, 오류 형식, stdout 오염 없음 | `tools/**` 변경 시 |
| 통합 | pytest + 에뮬레이터 | API → Firestore 기록 (LLM은 가짜 모델) | 모든 PR |
| E2E | Playwright | 마일스톤 완료 기준 시나리오 | `main` 머지 |
| 평가 | 스크립트 | 메타데이터 추출률, 버전 매칭 정확도 | 수동 / 주 1회 |

## 2. 외부 의존성 처리

- **LLM**: 테스트에서는 LangChain `FakeListChatModel` 등 가짜 모델. 실제 공급자 호출 테스트는 `@pytest.mark.live`로 분리, CI 기본 제외.
- **외부 검색 API**: 응답을 녹화한 픽스처(VCR 방식, `pytest-recording`) 사용. 월 1회 재녹화로 API 변경 감지.
- **Drive**: `DriveClient` 인터페이스의 메모리 구현. 실제 Drive는 E2E에서 테스트 계정으로만.
- **llama server**: dev 수동 테스트 (M6 완료 기준).

## 3. 필수 보안 규칙 테스트 케이스

- [ ] 로그인 안 한 사용자는 아무것도 못 읽는다
- [ ] 사용자 A는 `users/B/**`를 읽지도 쓰지도 못한다
- [ ] 본인도 `users/{uid}/apiKeys/*`를 읽지 못한다
- [ ] 본인도 `users/{uid}/meta/llmKeys`에 쓰지 못한다 (읽기는 가능)
- [ ] `citationCache` 읽기는 로그인 사용자 허용, 쓰기는 거부
- [ ] 목록에 없는 하위 컬렉션 이름으로는 쓰기 거부
- [ ] 클라이언트는 `createdBy: "agent"` 문서를 만들지 못한다
- [ ] 논문은 존재하는 버전을 기본 버전으로 가리켜야 만들고 고칠 수 있다, 없는 논문 아래 버전은 만들 수 없다
- [ ] 기본 버전은 논문이 있는 한 지울 수 없다 (기본 버전 변경·논문 삭제와 같은 배치면 가능)

규칙 테스트는 `demo-jjok-rules` 프로젝트 ID를 쓴다. 개발용 에뮬레이터(`demo-jjok`)가 떠 있어도 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 pnpm --filter @jjok/firebase exec vitest run`으로 데이터를 건드리지 않고 돌릴 수 있다.

## 4. 평가 데이터셋

### 4.1 메타데이터 추출 (N-03, M1 완료 기준)

- `eval/metadata/`: 논문 PDF 50편 + 정답 메타데이터 JSON (제목, 저자, 연도, venue, DOI/arXiv).
- 구성: arXiv 프리프린트 20, 학회 최종본 20 (NeurIPS/ICML/ICLR/CVPR/ACL), 저널 5, 식별자 없는 PDF 5.
- 지표: 필드별 정확도, "자동으로 채워짐" 비율 (제목+저자+연도 모두 맞으면 성공). 목표 ≥ 90%.
- 저작권: PDF는 저장소에 넣지 않고 다운로드 스크립트(`eval/metadata/fetch.py`)와 URL 목록만 커밋.

### 4.2 버전 매칭 (F-1.4, M5 완료 기준)

- `eval/matching/pairs.jsonl`: `{a, b, label: same_work | different}` 100쌍 이상. arXiv↔학회 버전, 워크숍↔학회, 학회↔저널 확장 버전, 제목이 비슷한 다른 논문(어려운 음성 사례) 포함.
- 지표: precision, recall. 우선순위는 **precision** (잘못 묶는 것이 안 묶는 것보다 나쁘다). 목표 precision ≥ 0.98, recall ≥ 0.85 (M5에서 조정).

## 5. 마일스톤 완료 기준 → 검증 방법

| 마일스톤 | 완료 기준 (개발 계획) | 검증 |
| --- | --- | --- |
| M0 | 로그인 후 드라이브 업/다운로드, 다른 계정 문서 읽기 불가 | E2E `e2e/tests/m0-auth-drive.spec.ts` (에뮬레이터 + 메모리 드라이브) + 보안 규칙 테스트 13건 + 실제 Drive 수동 점검 (jjok-dev) |
| M1 | 50편 업로드 시 메타데이터 90%+ 자동, 분류 기준 교차 필터 동작 | 평가 4.1 + E2E `m1-library.spec.ts`. 진행 중 추가: `m1-versions.spec.ts`(M1-01), `m1-upload.spec.ts`(M1-02: 드래그 앤 드롭, 여러 파일, 중복, PDF 아님) |
| M2 | 하이라이트를 다른 논문 하이라이트에 링크, 양쪽 백링크 이동 | E2E `m2-annotation-link.spec.ts` |
| M3 | 템플릿으로 노트 생성, 위키 링크 노트 그래프 | E2E `m3-notes.spec.ts` |
| M4 | 같은 컬렉션을 인용/공동 저자 그래프로 전환, 핀 꽂은 논문으로 리더 이동 | E2E `m4-graph.spec.ts` (citationCache 픽스처) |
| M5 | 사이트별 검색 결과 바로 추가, arXiv 버전·학회 버전 한 논문으로 묶임 | E2E `m5-search.spec.ts` + 평가 4.2 |
| M6 | 사용자 키로 요약 → 노트 저장 → 검색에 걸림, dev llama 동일 흐름 | E2E (가짜 모델) + 수동 live 테스트 체크리스트 |
| M7 | 베타 사용자 5명 이상이 1주 사용 | 사용 로그, 피드백 설문 |

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
| 0.1.1 | 2026-10-19 | M0 검증 방법 구체화 |
| 0.2.0 | 2026-10-20 | 작품·대표 버전 규칙 케이스, 규칙 테스트 프로젝트 ID 분리 |
| 0.2.1 | 2026-10-20 | 용어 교체: 작품 → 논문, 판 → 버전, 대표 버전 → 기본 버전 (DEV-011, H-003) |
| 0.2.2 | 2026-10-20 | 용어 확정 반영: 분류 기준, 하이라이트·메모, 논문 그래프, 핀 꽂은 논문, 노트 검색, 검색 사이트, 백엔드 서버 등 (DEV-011 1.0.0, H-003) |
| 0.2.3 | 2026-10-20 | M1 진행 중 E2E 목록 |
