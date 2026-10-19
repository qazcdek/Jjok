# ADR-0009: dev DB: SQLite 대신 Firestore 에뮬레이터

- 상태: accepted
- 날짜: 2026-10-19
- 근거: DEV-002 §2, DEV-007 §3

## 배경

dev는 로컬에서 돌리므로 클라우드 Firestore 대신 SQLite 같은 로컬 DB를 쓸 수 있는지 검토했다. 함께 걸린 조건: 백엔드·DB 예산 월 2만 원, prod는 Firestore로 결정됨 (ADR-0002).

## 결정

- dev 기본 DB는 **Firebase Emulator Suite의 Firestore + Auth 에뮬레이터**로 한다. 로컬에서 돌고 비용·사용량이 0이다.
- 실제 Google 로그인·Drive·여러 기기 동기화를 확인할 때만 클라우드 `jjok-dev` 프로젝트를 쓴다.
- SQLite는 쓰지 않는다.

## SQLite를 쓰지 않는 이유

- 웹 앱은 브라우저에서 Firestore SDK로 DB를 직접 읽고 쓴다. SQLite를 쓰려면 브라우저와 DB 사이에 API 서버와 데이터 접근 계층을 새로 만들어야 하고, prod에서는 쓰이지 않는 코드가 된다.
- 실시간 구독, 오프라인 캐시, 보안 규칙은 Firestore에만 있는 동작이다. SQLite로는 이 부분을 dev에서 검증할 수 없다. 특히 보안 규칙(N-01)은 에뮬레이터에서만 테스트할 수 있다.
- 쿼리 제약(쿼리당 `array-contains` 하나 등)이 달라, dev에서 되는 기능이 prod에서 깨질 수 있다.

## 결과

- dev와 prod가 같은 코드, 같은 규칙으로 돈다. 에뮬레이터 연결 여부만 `VITE_USE_EMULATORS`로 바꾼다.
- 에뮬레이터 데이터는 `firebase emulators:start --import ./.emulator-data --export-on-exit`로 로컬에 보존한다 (git 제외).
- 에뮬레이터를 쓰려면 Java가 필요하다.
- Drive는 에뮬레이터가 없으므로 dev에서도 실제 Google 계정이 필요하다 (DEV-007 §3).
