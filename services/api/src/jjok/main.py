"""백엔드 서버 진입점: `uvicorn jjok.main:app`

M6 에서 Cloud Run 서비스를 api / agent 로 나눌 때 진입점을 따로 둔다 (ADR-0012).
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import health, me, tools
from .http import lifespan
from .settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Jjok API", version="0.1.0", lifespan=lifespan)
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
