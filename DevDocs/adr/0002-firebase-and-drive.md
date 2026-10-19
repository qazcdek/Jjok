# ADR-0002: 저장소: Firebase(Auth·Firestore) + Google Drive(drive.file)

- 상태: accepted
- 날짜: 2026-10-19
- 근거: 기능 명세 6절, 기술 설계 메모 '저장소'

## 배경

구글 계정 하나로 로그인하고, PDF는 사용자 드라이브에, 나머지는 가벼운 DB에 두기로 했다.

## 결정

- 인증: Firebase Authentication (Google)
- 데이터: Cloud Firestore
- PDF: 사용자 Drive `/논문앱/files/<workId>/<versionId>.pdf`, 스코프 `drive.file`
- 서버는 사용자 Drive에 접근하지 않는다. 파일 입출력은 브라우저가 한다.

## 결과

- 실시간 동기화·오프라인 캐시를 Firestore가 맡는다.
- `drive.file`은 비민감 스코프라 심사 부담이 작지만, 사용자가 드라이브에 직접 넣은 파일은 보이지 않는다.
- Drive 액세스 토큰 갱신을 따로 구현해야 한다 (I-03).
- 무료 한도와 결제 계정 필요 여부는 확인 전이다 (I-02).
