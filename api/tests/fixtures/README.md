# Recorded Fixtures

Snapshots of the live public feeds, captured from the sandbox on **2026-09-03** and
trimmed to what the unit tests assert on. They are the contract for the normalizer
tests (`test_normalizers_*.py`): change a parser and these files tell you what real
upstream data looked like.

| File | Source & query | Curated contents |
|---|---|---|
| `wfigs_incidents.json` | WFIGS `Incident_Locations_Current/FeatureServer/0/query` with `where=POOState='US-OR'`, `outSR=4326`, `f=geojson` | A handful of Oregon incidents with the real schema (UFI, name, county, size, containment, cause, ModifiedOnDateTime_dt) |
| `wfigs_perimeters.json` | WFIGS `Wildfire_Perimeters/FeatureServer/0/query` with `where=attr_POOState='US-OR'`, `outSR=4326` | Polygon + MultiPolygon perimeters keyed by `attr_UniqueFireIdentifier` (geometry coordinates truncated) |
| `nws_alerts.json` | `api.weather.gov/alerts/active?area=OR` (no `limit` — it 400s) | Fire-weather events (Red Flag Warning), non-fire noise (Flash Flood Watch), polygon geometry, and a null-geometry alert |
| `openmeteo_current.json` | `air-quality-api.open-meteo.com/v1/air-quality?current=us_aqi` per point | One response body per reference city — 5 cities + rural Oregon towns (Pendleton, Klamath Falls, La Grande) |
| `inciweb_rss.xml` | `inciweb.wildfire.gov/incidents/rss.xml` | Items with the `<code> <name>` title form (`ORMHF Austin Fire`), `&nbsp;` entities, `Last updated:` dates, one item without a code prefix |

## Refreshing

```bash
# 1. Record fresh payloads (any HTTP client) against the sources above.
# 2. Trim to the fields the tests assert on — keep nulls and edge cases.
# 3. Re-run: pytest api/tests -q
```

Keep the curated quirks when you refresh (null geometry, unprefixed RSS titles,
`&nbsp;`) — they are regression tests for upstream messiness, not sample data.
