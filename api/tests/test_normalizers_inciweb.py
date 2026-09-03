"""InciWeb RSS normalizer unit tests against the recorded live fixture (spec criterion 9)."""

from pathlib import Path

from app.feeds import inciweb

FIXTURES = Path(__file__).parent / "fixtures"


def load_items() -> list[inciweb.InciwebItem]:
    return inciweb.parse_items((FIXTURES / "inciweb_rss.xml").read_text())


def test_fixture_records_known_rss_quirks() -> None:
    """The fixture is curated to carry each quirk the parser must tolerate."""
    xml_text = (FIXTURES / "inciweb_rss.xml").read_text()
    assert "ORMHF Austin Fire" in xml_text  # "<code> <name>" title form
    assert "ORWWF McCully Fire" in xml_text
    assert "&amp;nbsp;" in xml_text  # double-escaped HTML entity in description
    assert "Last updated: 2026-09-03" in xml_text  # description-embedded date
    assert "<item>" in xml_text


def test_split_title_with_slug_code() -> None:
    code, name = inciweb.split_title(
        "ORMHF Austin Fire",
        "https://inciweb.wildfire.gov/incident-information/ormhf-austin-fire",
    )
    assert code == "ORMHF"
    assert name == "Austin Fire"


def test_split_title_falls_back_to_title_prefix() -> None:
    code, name = inciweb.split_title("SMNF Boze Fire", "https://inciweb.wildfire.gov/weird-link")
    assert code == "SMNF"
    assert name == "Boze Fire"


def test_split_title_unprefixed_title() -> None:
    code, name = inciweb.split_title("Plain Name", "")
    assert code == ""
    assert name == "Plain Name"


def test_parse_summary_strips_entities_and_extracts_updated() -> None:
    summary, updated = inciweb.parse_summary(
        "Last updated: 2026-08-29, 8:59 a.m.&nbsp;&nbsp;---\n\nIncident Overview: Crews continue"
        " mop-up. &nbsp;Containment lines are holding."
    )
    assert updated == "2026-08-29"
    assert summary == "Crews continue mop-up. Containment lines are holding."


def test_parse_summary_missing_overview_block() -> None:
    summary, updated = inciweb.parse_summary("Last updated: 2026-08-29, 8:59 a.m.&nbsp;")
    assert summary == "Last updated: 2026-08-29, 8:59 a.m."  # whole text, whitespace-squeezed
    assert updated == "2026-08-29"
    assert inciweb.parse_summary(None) == ("", None)


def test_parse_items_normalizes_fixture() -> None:
    items = load_items()
    assert len(items) == 8
    assert {i.name for i in items} == {
        "Austin Fire",
        "McCully Fire",
        "Grasshopper Fire",
        "Three Queens",
        "Moose Mountain",
        "Ross Fire",
        "Grand Park 2 Fire",
        "Wonderland Complex",
    }
    austin = next(i for i in items if i.name == "Austin Fire")
    assert austin.code == "ORMHF"
    assert austin.link == "http://inciweb.wildfire.gov/incident-information/ormhf-austin-fire"
    assert austin.lastUpdated == "2026-09-03"
    assert austin.summary.startswith("The Austin Fire is located")
    assert "Incident Overview:" not in austin.summary
    assert "\xa0" not in austin.summary  # nbsp entities unescape then squeeze to spaces
    assert austin.guid == "330447"  # numeric non-permalink guids
    assert austin.publishedAt is not None and austin.publishedAt.endswith("EDT")


def test_find_item_joins_by_normalized_name() -> None:
    items = load_items()
    assert inciweb.find_item("Austin Fire", items).code == "ORMHF"  # type: ignore[union-attr]
    assert inciweb.find_item("austin fire", items).code == "ORMHF"  # case-insensitive
    assert inciweb.find_item("McCully  Fire", items).code == "ORWWF"  # whitespace-tolerant
    assert inciweb.find_item("Grasshopper Fire", items).code == "ORMHF"
    assert inciweb.find_item("Chetco Bar", items) is None  # absent from fixture


def test_find_item_skips_codeless_items() -> None:
    """Items without a parseable code never join — they are ambiguous matches."""
    synthetic = inciweb.InciwebItem(
        code="", name="North Cayuse", title="North Cayuse", link="", summary=""
    )
    assert inciweb.find_item("North Cayuse", [synthetic]) is None


def test_norm_name_folds_punctuation() -> None:
    assert inciweb.norm_name("O'Brien Creek") == "o brien creek"
    assert inciweb.norm_name("  Fire-Fire  ") == "fire fire"
