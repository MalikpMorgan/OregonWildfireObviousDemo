"""WFIGS normalizer unit tests against recorded live fixtures (spec criterion 9)."""

import json
from pathlib import Path
from typing import Any

from app.feeds import wfigs

FIXTURES = Path(__file__).parent / "fixtures"

# Generous Oregon-ish bounds — proof the recorded query shipped EPSG:4326 lon/lat,
# not the layer's native NAD83 (EPSG:4269) coordinates.
OR_BOUNDS = (-126.0, 40.0, -114.0, 48.0)


def load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


def test_fixture_recorded_with_us_or_filter() -> None:
    """The fixture was captured with where=POOState = 'US-OR' — every feature agrees."""
    features = load("wfigs_incidents.json")["features"]
    assert features
    assert all(f["properties"]["POOState"] == "US-OR" for f in features)


def test_normalize_incident_full_fields() -> None:
    feature = next(
        f
        for f in load("wfigs_incidents.json")["features"]
        if f["properties"].get("UniqueFireIdentifier") == "2026-OR973S-000206"
    )
    incident = wfigs.normalize_incident(feature)
    assert incident is not None
    assert incident.incidentId == "2026-OR973S-000206"
    assert incident.name == "North Cayuse"
    assert incident.county == "Umatilla"
    assert incident.acres == 4887
    assert incident.containmentPct == 97
    assert incident.cause == "Human"
    assert incident.updatedAt is not None and incident.updatedAt.endswith("Z")
    assert incident.source == "wfigs" and incident.sourceUrl.startswith("https://")
    assert isinstance(incident.fetchedAt, int)


def test_normalize_incident_geometry_is_reprojected_decimal_degrees() -> None:
    for feature in load("wfigs_incidents.json")["features"]:
        incident = wfigs.normalize_incident(feature)
        assert incident is not None
        lon_min, lat_min, lon_max, lat_max = OR_BOUNDS
        assert lon_min < incident.lon < lon_max, f"lon {incident.lon} outside Oregon"
        assert lat_min < incident.lat < lat_max, f"lat {incident.lat} outside Oregon"


def test_normalize_incident_tolerates_nulls() -> None:
    """Null tolerance: blank county/acres/containment/cause pass through as None."""
    feature = {
        "properties": {
            "UniqueFireIdentifier": "2026-ORXXX-000001",
            "IncidentName": "Field Test",
            "POOCounty": None,
            "IncidentSize": None,
            "DiscoveryAcres": None,
            "PercentContained": None,
            "FireCause": None,
            "ModifiedOnDateTime_dt": None,
        },
        "geometry": {"type": "Point", "coordinates": [-120.5, 44.5]},
    }
    incident = wfigs.normalize_incident(feature)
    assert incident is not None
    assert incident.county is None
    assert incident.acres is None
    assert incident.containmentPct is None
    assert incident.cause is None
    assert incident.updatedAt is None


def test_normalize_incident_falls_back_to_discovery_acres() -> None:
    feature = {
        "properties": {
            "UniqueFireIdentifier": "2026-ORXXX-000002",
            "IncidentName": "Field Test",
            "IncidentSize": None,
            "DiscoveryAcres": 0.25,
        },
        "geometry": {"type": "Point", "coordinates": [-120.5, 44.5]},
    }
    incident = wfigs.normalize_incident(feature)
    assert incident is not None
    assert incident.acres == 0.25


def test_normalize_incident_uses_irwin_id_fallback() -> None:
    feature = {
        "properties": {"IrwinID": "{FF6A26AE-ECE2-48C3-8631-F668328D9EA8}", "IncidentName": "X"},
        "geometry": {"type": "Point", "coordinates": [-120.5, 44.5]},
    }
    incident = wfigs.normalize_incident(feature)
    assert incident is not None
    assert incident.incidentId == "{FF6A26AE-ECE2-48C3-8631-F668328D9EA8}"


def test_normalize_incident_skips_unfixable_features() -> None:
    assert wfigs.normalize_incident({"properties": {}, "geometry": None}) is None
    assert (
        wfigs.normalize_incident(
            {"properties": {"UniqueFireIdentifier": "x"}, "geometry": {"type": "Point"}}
        )
        is None
    )


def test_normalize_perimeter_splits_multipolygon() -> None:
    feature = next(
        f
        for f in load("wfigs_perimeters.json")["features"]
        if f["properties"].get("attr_UniqueFireIdentifier") == "2026-ORPRD-000480"
    )
    perimeter = wfigs.normalize_perimeter(feature)
    assert perimeter is not None
    assert perimeter.incidentId == "2026-ORPRD-000480"
    assert perimeter.polygons, "MultiPolygon parts must expand into Polygon models"
    assert all(p.type == "Polygon" and p.coordinates for p in perimeter.polygons)


def test_normalize_perimeter_skips_missing_join_key() -> None:
    polygon = {
        "type": "Polygon",
        "coordinates": [[[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 0.0]]],
    }
    feature = {"properties": {"attr_UniqueFireIdentifier": None}, "geometry": polygon}
    assert wfigs.normalize_perimeter(feature) is None
    assert wfigs.normalize_perimeter({"properties": {}, "geometry": None}) is None
