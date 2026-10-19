# ADR-0011: 웹 앱에 Google Analytics 사용

- 상태: accepted
- 날짜: 2026-10-19
- 근거: 사용자 결정 (2026-10-19), 개인정보처리방침 초안 (`apps/web/public/privacy.html`)

## 배경

Firebase 프로젝트를 만들 때 Google Analytics 를 켰다. 프로젝트 설정만으로는 수집되지 않고, 앱에 SDK 를 넣어야 수집된다. 넣으면 개인정보처리방침과 수집 고지가 바뀐다.

## 결정

웹 앱에 Firebase Analytics SDK 를 넣는다. 단, 다음 조건을 지킨다.

- **불러오는 조건**: 에뮬레이터 모드가 아니고 `VITE_FIREBASE_MEASUREMENT_ID` 가 있을 때만. SDK 는 동적 import 로 따로 불러온다 (`apps/web/src/lib/firebase/analytics.ts`).
- **끄는 기능**: Google 신호(`allow_google_signals: false`), 광고 개인화(`allow_ad_personalization_signals: false`).
- **이벤트에 넣지 않는 것**: 이름, 이메일, uid(`setUserId` 쓰지 않음), 논문 제목, 노트·주석 내용, 검색어, API 키. 사용자 정의 이벤트를 추가할 때는 기능 이름 같은 범주 값만 보낸다.
- **사용자 거부**: 앱 하단 "사용 통계 보내기" 체크를 끄면 그 기기에서 수집을 멈춘다 (`ga-disable-<id>` 플래그 + `setAnalyticsCollectionEnabled`). 기본값은 켜짐(옵트아웃 방식).
- **콘솔 설정** (사용자 작업): 데이터 보관 기간 2개월, Google 신호 끄기, 광고 연결 안 함.

## 결과

- 개인정보처리방침에 수집 항목·목적·보관 기간·위탁(Google LLC)·국외 이전·쿠키·끄는 방법을 추가했다.
- dev 프로젝트(`jjok-20fd1`)의 통계에는 개발 트래픽이 섞인다. prod 는 별도 프로젝트·속성이라 영향 없다.
- **미결**: 옵트아웃(기본 켜짐)으로 충분한지, 처음 방문 때 동의를 받는 옵트인이 필요한지는 법률 검토가 필요하다 (DevDocs/09-open-issues.md I-14). 공개 출시 전 결정한다.
