"""Tiny TTL clock cache holding each feed's last-good data.

TTL governs refetch cadence, not eviction: a fetch is attempted only when the cached
entry is older than the feed's TTL, and the most recent good value of any age is served
as ``stale`` when the upstream fails (the spec's degradation contract).
"""

import time
from collections.abc import Callable
from typing import Any

Clock = Callable[[], int]


def now_ms() -> int:
    """Wall-clock epoch milliseconds."""
    return int(time.time() * 1000)


class TTLCache:
    """key -> (value, write time). Optional maxsize evicts the oldest insert (FIFO)."""

    def __init__(self, clock: Clock = now_ms, maxsize: int | None = None) -> None:
        self._clock = clock
        self._maxsize = maxsize
        self._store: dict[str, tuple[Any, int]] = {}

    def set(self, key: str, value: Any) -> None:
        if (
            self._maxsize is not None
            and key not in self._store
            and len(self._store) >= self._maxsize
        ):
            del self._store[next(iter(self._store))]
        self._store[key] = (value, self._clock())

    def get(self, key: str) -> Any | None:
        """Last-good value for key regardless of age — that is the stale-serving copy."""
        entry = self._store.get(key)
        return entry[0] if entry is not None else None

    def time(self, key: str) -> int | None:
        entry = self._store.get(key)
        return entry[1] if entry is not None else None

    def age_ms(self, key: str) -> int | None:
        stamp = self.time(key)
        return None if stamp is None else self._clock() - stamp

    def clear(self) -> None:
        self._store.clear()


CACHE = TTLCache()
"""Shared per-feed last-good cache (one entry per feed key, plus AQI point keys)."""
