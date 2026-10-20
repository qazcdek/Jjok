# ADR-0006: 하이라이트 앵커: W3C Web Annotation 선택자 기반

- 상태: accepted
- 날짜: 2026-10-19
- 근거: 기능 명세 '하이라이트·링크 데이터 모델', DEV-003 §3.5–3.6

## 배경

PDF 다음에 Markdown 리더를 붙일 예정이라, 하이라이트 앵커가 포맷에 묶이면 재작업이 생긴다 (개발 계획 리스크 5).

## 결정

Anchor 타입은 document / page / text(TextQuote + TextPosition 보조) / region(페이지 기준 정규화 좌표). 링크는 별도 엔티티 `links {from, to, type, createdBy}`.

## 결과

- text 앵커는 PDF·Markdown 공통으로 쓴다.
- 복원 실패(위치를 잃은 하이라이트) 처리가 필요하다.
- 백링크와 논문 그래프의 사용자 정의 관계가 같은 links 컬렉션에서 나온다.
