"""Environment-driven settings for the API."""

import os

# The Vite dev server is the default SPA origin during local development.
DEFAULT_CORS_ORIGINS = ("http://localhost:5173",)


def cors_origins(env: dict[str, str] | None = None) -> list[str]:
    """Resolve allowed CORS origins from CORS_ORIGINS (comma-separated), trimmed."""
    source = os.environ if env is None else env
    raw = source.get("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins if origins else list(DEFAULT_CORS_ORIGINS)
