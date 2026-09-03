"""Feed clients — one module per public source (spec §Data layer).

Each client owns fetching + normalizing one source into the shared models. Fetchers
accept an optional httpx client (tests inject a MockTransport); production uses one
shared, pooled client with a descriptive User-Agent (api.weather.gov best practice).
"""

import httpx

from app.config import feed_timeout_seconds

USER_AGENT = "oregon-fire-air-dashboard/0.1 (public-feed aggregation; keyless)"

_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """Shared app-wide client — connection pooling + timeouts for every feed."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=feed_timeout_seconds(),
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        )
    return _client


async def close_http_client() -> None:
    """Release the shared client (app shutdown, tests)."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
