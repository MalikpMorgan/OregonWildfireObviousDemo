"""Shared degradation wrapper — every live source fails through the same contract.

Serve from cache while fresh (per-feed TTL), refetch when expired, fall back to the
last-good copy as ``stale`` when the upstream fails, and return ``failed`` with the
error only when there is no last-good data (spec §Degradation contract).
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from app.cache import CACHE, TTLCache, now_ms
from app.config import feed_ttl
from app.models import FeedResult, SourceMeta, SourceName

logger = logging.getLogger(__name__)

Fetcher = Callable[[], Awaitable[list[Any]]]

_STATUS_RANK = {"ok": 0, "stale": 1, "failed": 2}


def merge_envelopes(
    envelopes: list[FeedResult], source: SourceName, sourceUrl: str
) -> FeedResult:
    """Combine part-envelopes (AQI point + cities): worst status wins, data concatenates.

    fetchedAt reports the stalest part so the UI's "updated X ago" badge never overstates
    freshness; errors are joined so a partial failure stays visible.
    """
    data: list[Any] = []
    errors: list[str] = []
    for envelope in envelopes:
        data.extend(envelope.data or [])
        if envelope.error:
            errors.append(envelope.error)
    worst = max((envelope.status for envelope in envelopes), key=_STATUS_RANK.__getitem__)
    fetched_at = min(envelope.meta.fetchedAt for envelope in envelopes)
    # A failed merge with no surviving parts serves null data — the single-feed
    # failed contract — while partial failures keep the surviving rows.
    has_data = bool(data)
    return FeedResult(
        status=worst,
        data=data if has_data else (None if worst == "failed" else []),
        meta=SourceMeta(source=source, sourceUrl=sourceUrl, fetchedAt=fetched_at),
        error="; ".join(errors) or None,
    )


async def load_feed(
    key: str,
    *,
    fetcher: Fetcher,
    source: SourceName,
    sourceUrl: str,
    ttl_name: str | None = None,
    cache: TTLCache = CACHE,
) -> FeedResult:
    """Resolve one feed through the ok / stale / failed contract.

    Fetchers are resolved at call time by the routes, so tests can monkeypatch each
    upstream independently (the kill-switch matrix).
    """
    ttl_seconds = feed_ttl(ttl_name or key)
    age = cache.age_ms(key)
    if age is not None and age < ttl_seconds * 1000:
        return FeedResult(
            status="ok",
            data=cache.get(key),
            meta=SourceMeta(
                source=source, sourceUrl=sourceUrl, fetchedAt=cache.time(key) or now_ms()
            ),
        )
    try:
        data = await fetcher()
    except Exception as err:
        logger.warning("feed %s fetch failed: %s: %s", key, type(err).__name__, err)
        cached = cache.get(key)
        if cached is not None:
            return FeedResult(
                status="stale",
                data=cached,
                meta=SourceMeta(
                    source=source, sourceUrl=sourceUrl, fetchedAt=cache.time(key) or now_ms()
                ),
            )
        return FeedResult(
            status="failed",
            data=None,
            error=f"{type(err).__name__}: {err}",
            meta=SourceMeta(source=source, sourceUrl=sourceUrl, fetchedAt=now_ms()),
        )
    cache.set(key, data)
    return FeedResult(
        status="ok",
        data=data,
        meta=SourceMeta(
            source=source, sourceUrl=sourceUrl, fetchedAt=cache.time(key) or now_ms()
        ),
    )
