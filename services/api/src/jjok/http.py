"""외부 API 호출용 공용 httpx 클라이언트. 앱 수명 동안 하나를 쓴다 (연결 재사용)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request

USER_AGENT = "Jjok/0.1 (personal paper manager; https://github.com/qazcdek/Jjok)"


def new_client(**kwargs) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        **kwargs,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with new_client() as client:
        app.state.http = client
        yield


def get_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http
