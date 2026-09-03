"""load_feed / merge_envelopes unit tests — the ok / stale / failed contract in isolation."""

import httpx
import pytest

from app import config
from app.cache import TTLCache
from app.feeds.service import load_feed, merge_envelopes
from app.models import AirReading, FeedResult, SourceMeta

SOURCE = "nws"
URL = "https://api.weather.gov/alerts/active?area=OR"


def reading(us_aqi: int | None, at: int = 1) -> AirReading:
    return AirReading(
        source="open-meteo",
        sourceUrl=URL,
        fetchedAt=at,
        location="X",
        usAqi=us_aqi,
        categoryLabel="Good",
    )


def envelope(status: str, data: list[AirReading] | None, at: int = 1) -> FeedResult:
    return FeedResult(
        status=status,  # type: ignore[arg-type]
        data=data,
        meta=SourceMeta(source=SOURCE, sourceUrl=URL, fetchedAt=at),
        error=None if status != "failed" else "boom",
    )


async def test_first_fetch_serves_ok() -> None:
    cache: TTLCache = TTLCache()

    async def fetcher() -> list[dict[str, str]]:
        return [{"first": "fetch"}]

    result = await load_feed(
        "k", fetcher=fetcher, source=SOURCE, sourceUrl=URL, cache=cache
    )
    assert result.status == "ok"
    assert result.data == [{"first": "fetch"}]
    assert result.meta.source == SOURCE
    assert result.error is None


async def test_fresh_cache_short_circuits_fetch() -> None:
    cache: TTLCache = TTLCache()
    cache.set("k", [{"served": "cache"}])

    async def boom() -> list[dict[str, str]]:
        raise AssertionError("fetcher must not run while the entry is fresh")

    result = await load_feed(
        "k", fetcher=boom, source=SOURCE, sourceUrl=URL, cache=cache
    )
    assert result.status == "ok"
    assert result.data == [{"served": "cache"}]
    assert result.meta.source == SOURCE


async def test_upstream_failure_with_last_good_serves_stale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # ttl 0 makes the cached entry instantly expired, so the fetch is attempted
    monkeypatch.setattr(
        "app.config.FEED_TTL_DEFAULTS", {**config.FEED_TTL_DEFAULTS, "k": 0}
    )
    cache: TTLCache = TTLCache()
    cache.set("k", [{"last": "good"}])

    async def boom() -> list[dict[str, str]]:
        raise httpx.ConnectError("upstream down")

    result = await load_feed(
        "k", fetcher=boom, source=SOURCE, sourceUrl=URL, cache=cache
    )
    assert result.status == "stale"
    assert result.data == [{"last": "good"}]
    assert result.error is None


async def test_upstream_failure_without_cache_serves_failed_never_500() -> None:
    cache: TTLCache = TTLCache()

    async def boom() -> list[dict[str, str]]:
        raise httpx.ConnectError("upstream down")

    result = await load_feed(
        "k", fetcher=boom, source=SOURCE, sourceUrl=URL, cache=cache
    )
    assert result.status == "failed"
    assert result.data is None
    assert result.error is not None and "ConnectError" in result.error


async def test_refetch_after_ttl_refreshes_ok() -> None:
    class FakeClock:
        def __init__(self) -> None:
            self.ms = 1_000

        def __call__(self) -> int:
            return self.ms

    clock = FakeClock()
    cache: TTLCache = TTLCache(clock=clock)

    async def fetcher() -> list[dict[str, str]]:
        return [{"fresh": "data"}]

    first = await load_feed(
        "k", fetcher=fetcher, source=SOURCE, sourceUrl=URL, cache=cache
    )
    assert first.status == "ok"
    clock.ms += 10 * 60 * 1000  # past the default TTL band
    second = await load_feed(
        "k", fetcher=fetcher, source=SOURCE, sourceUrl=URL, cache=cache
    )
    assert second.status == "ok"
    assert second.data == [{"fresh": "data"}]
    assert second.meta.fetchedAt >= first.meta.fetchedAt


def test_merge_envelopes_worst_status_wins() -> None:
    merged = merge_envelopes(
        [envelope("ok", [reading(50)]), envelope("stale", [reading(51)])],
        source=SOURCE,
        sourceUrl=URL,
    )
    assert merged.status == "stale"
    assert len(merged.data or []) == 2
    assert merged.meta.fetchedAt == 1  # stalest part
    assert merged.error is None


def test_merge_envelopes_collects_partial_errors() -> None:
    merged = merge_envelopes(
        [envelope("failed", None, at=5), envelope("ok", [reading(42)])],
        source=SOURCE,
        sourceUrl=URL,
    )
    assert merged.status == "failed"
    assert merged.error == "boom"
    assert len(merged.data or []) == 1


@pytest.mark.parametrize(
    "statuses,expected",
    [
        (["ok", "ok"], "ok"),
        (["ok", "stale"], "stale"),
        (["stale", "failed"], "failed"),
        (["ok", "failed"], "failed"),
    ],
)
def test_merge_status_ranking(statuses: list[str], expected: str) -> None:
    merged = merge_envelopes(
        [envelope(status, [reading(1)]) for status in statuses],
        source=SOURCE,
        sourceUrl=URL,
    )
    assert merged.status == expected
