"""Shared pytest fixtures."""

from collections.abc import AsyncIterator

import httpx
import pytest

from app.cache import CACHE
from app.feeds import close_http_client
from app.main import app


@pytest.fixture(autouse=True)
def _fresh_cache():
    """Isolate the shared last-good cache per test (kill-switch determinism)."""
    CACHE.clear()
    yield
    CACHE.clear()


@pytest.fixture(autouse=True)
async def _close_shared_client():
    """Release the shared httpx client after each test."""
    yield
    await close_http_client()


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
