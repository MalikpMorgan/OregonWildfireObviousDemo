"""Environment-driven settings for the API."""

import logging
import os
from pathlib import Path

# The Vite dev server is the default SPA origin during local development.
DEFAULT_CORS_ORIGINS = ("http://localhost:5173",)


def cors_origins(env: dict[str, str] | None = None) -> list[str]:
    """Resolve allowed CORS origins from CORS_ORIGINS (comma-separated), trimmed."""
    source = os.environ if env is None else env
    raw = source.get("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins if origins else list(DEFAULT_CORS_ORIGINS)


# Per-feed cache TTLs in seconds — mid-range of the spec's bands (NWS 1-5 min, WFIGS
# points 5-15, perimeters 15-60, InciWeb 15, AQI 10-30); env-overridable per feed.
FEED_TTL_DEFAULTS: dict[str, int] = {
    "nws": 120,
    "wfigs_points": 600,
    "wfigs_perimeters": 1800,
    "inciweb": 900,
    "aqi": 900,
}

DEFAULT_FEED_TIMEOUT_SECONDS = 15.0


def _env_number(raw: str, fallback: float) -> float:
    try:
        value = float(raw)
    except ValueError:
        logging.warning("invalid numeric config %r — falling back to %s", raw, fallback)
        return fallback
    return value if value > 0 else fallback


def feed_ttl(name: str, env: dict[str, str] | None = None) -> int:
    """Resolve FEED_TTL_<NAME>_SECONDS, falling back to the spec default."""
    source = os.environ if env is None else env
    raw = source.get(f"FEED_TTL_{name.upper()}_SECONDS", "").strip()
    if raw:
        return int(_env_number(raw, FEED_TTL_DEFAULTS.get(name, 600)))
    return FEED_TTL_DEFAULTS.get(name, 600)


def feed_timeout_seconds(env: dict[str, str] | None = None) -> float:
    """Upstream HTTP timeout — FEED_TIMEOUT_SECONDS (default 15s)."""
    source = os.environ if env is None else env
    raw = source.get("FEED_TIMEOUT_SECONDS", "").strip()
    return _env_number(raw, DEFAULT_FEED_TIMEOUT_SECONDS) if raw else DEFAULT_FEED_TIMEOUT_SECONDS


def spa_dist_dir(env: dict[str, str] | None = None) -> Path | None:
    """Resolve SPA_DIST_DIR — a built frontend to serve at / (single-origin hosting).

    A configured directory is validated eagerly: a typo'd path must fail startup
    loudly, not silently demote the deployment to API-only.
    """
    source = os.environ if env is None else env
    raw = source.get("SPA_DIST_DIR", "").strip()
    if not raw:
        return None
    candidate = Path(raw)
    if not (candidate / "index.html").is_file():
        raise RuntimeError(f"SPA_DIST_DIR={raw!r} does not contain index.html")
    return candidate
