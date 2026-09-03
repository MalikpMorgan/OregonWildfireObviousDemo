# API — Oregon Fire & Air Dashboard

FastAPI service (Python 3.12+) that aggregates public fire, weather, and air-quality feeds
for the SPA. Every route serves the same envelope and a failing upstream never 500s. With
`SPA_DIST_DIR` set it also serves the built SPA at `/` — one origin for the whole app.

## Envelope contract

Every `/api/*` route returns `{status, data, meta, error}`:

- `ok` — fresh fetch or cache inside the feed's TTL
- `stale` — upstream failed; last-good data served with its original `meta.fetchedAt`
- `failed` — upstream failed and no last-good copy exists; `data` is `null`, `error` set

`meta` carries `{source, sourceUrl, fetchedAt}` so the UI always shows provenance and
freshness. Never derive meaning from color alone — downstream text labels are required.

## Routes

| Route | Source | Notes |
|---|---|---|
| `GET /api/fires` | WFIGS incident locations | `POOState='US-OR'`, `outSR=4326` (the layer ships NAD83/EPSG:4269); best-effort InciWeb id join by incident name |
| `GET /api/perimeters` | WFIGS interagency perimeters | `attr_POOState='US-OR'` (the prefix is required — the plain filter returns 0 rows), keyed by incident UFI |
| `GET /api/alerts` | NWS active alerts | `?area=OR`, filtered to fire-relevant events; no `limit` param (it 400s); tolerates null-geometry alerts |
| `GET /api/aqi` | Open-Meteo air quality | US AQI (model estimate) for an optional `lat`/`lon` point plus reference cities incl. rural Oregon |
| `GET /api/incidents/{id}/narrative` | InciWeb RSS | Joined to WFIGS by normalized incident name (WFIGS has no InciWeb field); empty `data` when the incident is not on InciWeb |
| `GET /healthz` | — | Liveness probe |

No API keys — every source is public. `meta.sourceUrl` links the official data source.

## Caching

Per-feed TTL cache (seconds, env-overridable via `FEED_TTL_<NAME>_SECONDS`):

| Feed | Default | Band from spec |
|---|---|---|
| `nws` | 120 | 60–300 |
| `wfigs_points` | 600 | 300–900 |
| `wfigs_perimeters` | 1800 | 900–3600 |
| `inciweb` | 900 | 900 |
| `aqi` | 900 | 600–1800 |

TTL governs refetch cadence, not eviction: last-good values of any age back the `stale`
contract. Geolocation AQI points use a small FIFO cache (512 entries).

## Configuration

- `CORS_ORIGINS` — comma-separated allowed origins (default: Vite dev server).
- `FEED_TIMEOUT_SECONDS` — upstream HTTP timeout (default 15s).
- `FEED_TTL_<NAME>_SECONDS` — per-feed cache TTL overrides.
- `SPA_DIST_DIR` — path to a built frontend (`index.html` + `assets/`); when set, the app
  serves the SPA at `/` so one process hosts both tiers (single-origin preview).

## Serving the SPA (single origin)

Build the frontend, then point the API at the output:

```bash
cd frontend && npm ci && npm run build
cd ../api && SPA_DIST_DIR=../frontend/dist uvicorn app.main:app --host 0.0.0.0 --port 8000
```

One origin serves the dashboard and `/api/*`; the SPA's same-origin fetches need no CORS.
When `SPA_DIST_DIR` is unset the service is API-only (`/` 404s), and a configured path
missing `index.html` fails startup loudly instead of silently demoting the deployment.

## Tests

```bash
ruff check .
pytest                # unit + contract tests (recorded fixtures, no network)
LIVE_FEEDS=1 pytest tests/test_live_smoke.py   # optional live smoke
```

Unit tests run against recorded snapshots in `tests/fixtures/` (see its README for
provenance). `test_kill_switch.py` forces a fetch on every request and kills each
upstream, asserting the ok → stale → failed ladder and that no route 500s.

## Scripts (from `api/`, with a virtualenv active)

- `pip install -r requirements-dev.txt` — runtime + dev dependencies
- `ruff check .` — lint
- `pytest` — test suite (pytest-asyncio + httpx)
- `uvicorn app.main:app --reload` — local dev server
