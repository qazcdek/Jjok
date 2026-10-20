"""Jjok 백엔드 서버.

모듈 경계 (ADR-0012):
- api/: 가벼운 동기 API (메타데이터 조회, 결정적 도구). LLM·LangGraph 를 import 하지 않는다.
- agent/: LangGraph 에이전트, LLM 라우팅, BYOK 키 (M6~).
- settings, auth, schema: 공용. agent 를 import 하지 않는다.
- main: 둘을 조립하는 진입점.
"""
