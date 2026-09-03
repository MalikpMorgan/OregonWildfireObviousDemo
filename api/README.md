# API — Oregon Fire & Air Dashboard

FastAPI service (Python 3.12+) that aggregates public fire, weather, and air-quality feeds for
the SPA. This scaffold ships the `/healthz` surface and the env-configurable CORS boundary;
the feed clients, TTL cache, and ok/stale/failed envelopes arrive in later PRs.

## Configuration

- `CORS_ORIGINS` — comma-separated list of allowed origins. Defaults to the Vite dev server
  (`http://localhost:5173`).

## Scripts (from `api/`, with a virtualenv active)

- `pip install -r requirements-dev.txt` — runtime + dev dependencies
- `ruff check .` — lint
- `pytest` — test suite (pytest-asyncio + httpx)
- `uvicorn app.main:app --reload` — local dev server
