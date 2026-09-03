"""TTL cache unit tests — freshness windows, last-good retention, FIFO bounding."""

from app.cache import TTLCache


class FakeClock:
    """Mutable epoch-ms clock for deterministic TTL behavior."""

    def __init__(self, start_ms: int = 1_000) -> None:
        self.ms = start_ms

    def __call__(self) -> int:
        return self.ms


def test_set_get_roundtrip() -> None:
    cache: TTLCache = TTLCache()
    cache.set("k", [{"id": 1}])
    assert cache.get("k") == [{"id": 1}]
    assert cache.time("k") is not None
    assert cache.age_ms("k") < 1000


def test_missing_key() -> None:
    cache: TTLCache = TTLCache()
    assert cache.get("missing") is None
    assert cache.time("missing") is None
    assert cache.age_ms("missing") is None


def test_last_good_survives_expiry() -> None:
    """Expired entries are not evicted — last-good data backs the stale contract."""
    clock = FakeClock()
    cache: TTLCache = TTLCache(clock=clock)
    cache.set("k", "old")
    clock.ms += 10_000  # far past any TTL
    assert cache.age_ms("k") == 10_000
    assert cache.get("k") == "old"


def test_clear_drops_everything() -> None:
    cache: TTLCache = TTLCache()
    cache.set("a", 1)
    cache.set("b", 2)
    cache.clear()
    assert cache.get("a") is None and cache.get("b") is None


def test_maxsize_evicts_oldest_insert() -> None:
    cache: TTLCache = TTLCache(maxsize=2)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    assert cache.get("a") is None  # oldest insert evicted
    assert cache.get("b") == 2 and cache.get("c") == 3
    cache.set("d", 4)
    assert cache.get("b") is None
    assert cache.get("c") == 3 and cache.get("d") == 4
