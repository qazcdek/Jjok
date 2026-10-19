---
doc_id: DEV-004
title: 인증·권한·보안
version: 0.1.0
status: draft
updated: 2026-10-19
sources:
  - UserDocs/기능 명세.md (v0.1) — 6. 동기화 및 저장소, 저장소: 드라이브 + Firebase
  - UserDocs/v1 개발 계획.md — M0, M6, M7, 리스크
---

# 인증·권한·보안

## 1. 인증

| 주체 | 방식 |
| --- | --- |
| 웹 앱 → Firebase | Firebase Authentication, Google 제공자만 사용 (가입도 Google만) |
| 웹 앱 → Drive | Google OAuth 액세스 토큰, 스코프 `https://www.googleapis.com/auth/drive.file` |
| 웹 앱 → 에이전트 서버 | `Authorization: Bearer <Firebase ID 토큰>`, 서버가 Admin SDK로 검증 후 `uid` 사용 |
| 에이전트 서버 → Firestore, KMS | Cloud Run 서비스 계정 (최소 권한) |

### OAuth 스코프

- 요청 스코프: `openid`, `email`, `profile`, `drive.file`. 그 외는 요청하지 않는다.
- `drive.file`은 비민감 스코프라 심사 부담이 작지만, 동의 화면 브랜딩 검증은 필요하다 → M0에서 신청 (개발 계획 리스크 1).
- 검증 전에는 테스트 사용자(최대 100명)로 베타를 운영한다.

## 2. Firestore 보안 규칙 (초안)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function signedIn() { return request.auth != null; }
    function isOwner(uid) { return signedIn() && request.auth.uid == uid; }

    match /users/{uid} {
      allow read, create, update: if isOwner(uid);
      allow delete: if false;   // 계정 삭제는 서버 경유

      // 사용자 데이터 컬렉션: 이름을 명시적으로 나열한다 (와일드카드 금지)
      match /{coll}/{docId=**} {
        allow read, write: if isOwner(uid) && coll in [
          'works', 'axes', 'collections', 'tags', 'annotations', 'links',
          'notes', 'templates', 'graphViews', 'notifications'
        ];
      }

      // 키 표시 정보(last4): 본인 읽기만, 쓰기는 서버만
      match /meta/llmKeys {
        allow read: if isOwner(uid);
        allow write: if false;
      }

      // BYOK 암호문: 클라이언트 접근 전면 금지
      match /apiKeys/{provider} {
        allow read, write: if false;
      }
    }

    match /citationCache/{paperKey} {
      allow read: if signedIn();
      allow write: if false;    // 서버(Admin SDK)만
    }
  }
}
```

> 주의: Firestore 규칙은 매칭되는 규칙 중 **하나라도 allow면 허용**된다. `match /{sub=**}` 같은 포괄 와일드카드를 두면 `apiKeys`까지 열리므로, 사용자 데이터 컬렉션은 이름을 나열한다. 새 컬렉션을 추가하면 이 목록과 [03-data-model.md](03-data-model.md)를 함께 고친다. M0 보안 규칙 테스트에 **"apiKeys 읽기 거부"**, **"meta/llmKeys 쓰기 거부"** 케이스를 반드시 넣는다.
>
> 키 표시 정보를 `users/{uid}` 본문(`settings.llm.keys`)이 아니라 별도 문서 `meta/llmKeys`에 두는 이유: `diff().affectedKeys()`는 최상위 필드만 비교하므로 중첩 필드 하나만 서버 전용으로 막기 어렵다.

### 필드 검증

- `createdBy == "agent"`인 annotation·link는 클라이언트가 만들 수 없게 한다 (사용자가 수락할 때 `status`만 바꿀 수 있음).
- 필수 필드·타입 검증은 규칙에 최소한만 두고 (`schemaVersion`이 number인지 등), 상세 검증은 클라이언트 스키마로 한다.

## 3. BYOK API 키 (F-7.7, N-02)

### 저장

1. 사용자가 설정 화면에서 키 입력 → `PUT /v1/keys/{provider}` (HTTPS, 본문에 평문 키)
2. 서버: 공급자에 가벼운 검증 호출(모델 목록 조회 등) → 실패 시 400
3. 서버: Cloud KMS `encrypt` (키 링 `jjok-byok`, 키 `user-api-keys`) → `users/{uid}/apiKeys/{provider}`에 암호문 저장
4. 서버: `users/{uid}/meta/llmKeys`의 `{provider}: {last4, updatedAt}` 기록
5. 응답: `{provider, last4}` — 평문 반환 없음

### 사용

- LLM 호출 직전에 복호화, 요청 범위 변수에만 보관. 캐시하지 않는다(또는 짧은 TTL 메모리 캐시 — M6에서 결정).
- 로깅: 요청/응답 로깅 미들웨어에서 `Authorization`, `x-api-key`, 키 패턴(`sk-`, `AIza` 등)을 마스킹한다.
- 예외 메시지에 키가 섞이지 않도록 LLM SDK 예외를 감싸서 재발행한다.

### 삭제·회전

- `DELETE /v1/keys/{provider}` → 문서와 last4 삭제.
- KMS 키 회전 시 `kmsKeyVersion`으로 구버전 암호문 식별, 사용 시점에 재암호화.

### dev 환경

- dev는 Cloud KMS 대신 로컬 키셋(`.secrets/dev-keyset.json`, git 제외)으로 같은 인터페이스를 구현한다. 인터페이스: `KeyCipher.encrypt(bytes) / decrypt(bytes)`.

## 4. 에이전트 서버 보안

- CORS: prod는 Hosting 도메인만, dev는 `localhost:5173`.
- 요청 크기 제한 (텍스트 본문 예: 2 MB).
- 사용자별 속도 제한 (외부 검색 API 보호): 분당 N회 — 값은 M5에서 결정.
- 도구 서브프로세스에는 API 키를 환경변수로 넘기지 않는다. LLM 호출은 서버 프로세스에서만 한다.
- `APP_ENV != dev`이면 `llama` provider 요청은 400으로 거부 (N-06). 클라이언트 숨김만으로는 부족하다.

## 5. M7 보안 점검 체크리스트

- [ ] 보안 규칙 테스트 전체 통과 (다른 uid 접근, apiKeys, citationCache 쓰기)
- [ ] API 키 평문이 응답·로그·Firestore 어디에도 없음 (로그 검색)
- [ ] KMS 권한이 에이전트 서비스 계정에만 있음
- [ ] OAuth 스코프가 위 4개뿐
- [ ] CORS, 요청 크기, 속도 제한 설정 확인
- [ ] 의존성 취약점 검사 (`npm audit`, `uv pip audit` 또는 `pip-audit`)

## 변경 이력

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 0.1.0 | 2026-10-19 | 최초 작성 |
