"""에이전트 서버 진입점: `uvicorn agent.main:app`"""

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import health, me, tools
from .settings import get_settings


def create_app() -> FastAPI:
    # .env 의 값(예: S2_API_KEY)을 도구 프로세스에도 넘길 수 있게 환경 변수로 올린다.
    # 이미 설정된 환경 변수가 우선한다.
    load_dotenv(override=False)
    settings = get_settings()
    app = FastAPI(title="Jjok Agent", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(HTTPException)
    async def _error_format(_: Request, exc: HTTPException) -> JSONResponse:
        # 공통 오류 형식 {"error": {...}} (DevDocs/05-agent-server.md §1.1)
        detail = exc.detail
        if not (isinstance(detail, dict) and "error" in detail):
            detail = {"error": {"code": "http_error", "message": str(detail)}}
        return JSONResponse(detail, status_code=exc.status_code, headers=exc.headers)

    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(tools.router)
    return app


app = create_app()
