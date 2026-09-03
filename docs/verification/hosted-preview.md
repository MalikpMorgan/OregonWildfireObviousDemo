# Hosted preview — V1 spec verification results

Deployment: FastAPI serving the built SPA at one origin (single process, `SPA_DIST_DIR`)
under tmux session `svc-8710` on the Obvious project sandbox, registered at
https://17nzhcbnak-8710.hosted.obvious.ai — persistent URL, wake-on-request.

- Tested head SHA: `266625ec3528c199adfdc9137aebc66f9e865380` (`chore/hosted-preview`)
- Captured: 2026-09-03 (UTC), live smoke against the real public feeds; live tests skip
  gracefully offline (they were not offline — all four feeds answered).
- Evidence assets recorded per criterion via qa-evidence-upload against the head SHA.

## Results — all nine criteria PASS

| # | Criterion | Verdict | Live evidence |
|---|---|---|---|
| 1 | Map + list render the full `/api/fires` envelope (POOState='US-OR'), tooltips, list↔map selection sync | PASS | Raw WFIGS `returnCountOnly` = 117 = envelope items = 117 list options in the DOM; ArrowDown+Enter selected `incident-option-2026-ORPRD-000098` and opened the detail |
| 2 | Perimeters as polygons; point-only without error | PASS | `/api/perimeters` live: 59/59 with polygon geometry; 117 points listed with the perimeter layer in the legend, no errors |
| 3 | NWS alerts filtered to fire-relevant, overlays + list, official links | PASS | Raw `alerts/active?area=OR` = 4 events, all non-fire (Special Weather Statement, Tornado Warning, Flash Flood Watch ×2) → envelope correctly 0; legend renders the NWS layer with the official link |
| 4 | AQI panel: US AQI, text category, "model estimate", attribution, timestamps, geolocation + ≥5 reference cities incl. rural | PASS | Live panel: 8 cities (Portland 30, Salem 30, Eugene 31, Bend 29, Medford 26, Pendleton 26, Klamath Falls 29, La Grande 69 Moderate), each with number + text category + "Model estimate"; "Source: Open-Meteo, updated just now"; aqi.oregon.gov + oregonsmoke.org links; "Use my location" gate |
| 5 | Failing each feed degrades only its panel (stale-with-age / failed-with-fallback) | PASS (CI path) | Upstream kill-switch suite 8/8 passed (stale → failed per feed, siblings unaffected); frontend envelope-state rendering 61/61. Live upstreams were healthy at capture — the spec's named verification path for this row is the kill-switch + frontend suites |
| 6 | Exact §2.4 evacuation wording, 36 county links resolve, EN/ES parity | PASS | Live EN: "Level 1 – BE READY / 2 – BE SET / 3 – GO NOW!"; ES (`html lang="es"`): "Nivel 1 – ESTÉ PREPARADO / 2 – ESTÉ LISTO / 3 – ¡VÁYASE AHORA!"; link checker 78 passed / 0 failed (includes all 36 counties); i18n string-coverage test green |
| 7 | Relief entries carry sources + lastReviewed; links resolve | PASS | Live relief surface: "Reviewed September 3, 2026" + "Sources: American Red Cross — Cascades Region"; link checker 78 passed / 0 failed; counties schema test green |
| 8 | Keyboard-only map→list→detail→evacuation→relief; WCAG 2.1 AA; reduced-motion | PASS | Keyboard: list focus → Enter → detail; tablist arrows switch surfaces (roving tabindex); axe suite green in Vitest; Lighthouse WCAG 2.1 AA gate in CI; `prefers-reduced-motion` present in the built CSS |
| 9 | Normalizer unit tests against recorded fixtures (US-OR filter, NAD83 reprojection, nulls, RSS quirks) | PASS | 30/30 normalizer tests passed; live tests gated behind `LIVE_FEEDS=1` (4 skipped in the default run) |

Local gates on the same SHA: API ruff clean, pytest 72 passed / 4 skipped (gated live
smoke); frontend ESLint clean, Vitest 61 passed; `tsc -b && vite build` clean with zero
`localhost:8000` in the emitted bundle (same-origin verified).

## Deployment notes

- Build: `cd frontend && npm ci && npm run build`
- Serve: `cd api && SPA_DIST_DIR=../frontend/dist .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8710`
- Register: `obvious hosted register --port=8710 --startup-command='<the command above>' --install='echo ok'`
- Live smoke: `LIVE_FEEDS=1 pytest tests/test_live_smoke.py` (skips gracefully offline)
