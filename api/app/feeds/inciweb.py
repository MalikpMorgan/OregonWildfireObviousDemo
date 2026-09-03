"""InciWeb RSS client — per-incident narrative summaries (research artifact §1.3).

Item titles are "<InciWeb code> <fire name>" (e.g. "ORMHF Austin Fire"); the code is
confirmed against the link slug before use. WFIGS carries no InciWeb field (verified
against the live layer schema 2026-09-03), so the join to incidents is by normalized
incident name — see ``find_item``.
"""

import re
import xml.etree.ElementTree as ElementTree
from html import unescape

import httpx
from pydantic import BaseModel

from app.feeds import get_http_client

RSS_URL = "https://inciweb.wildfire.gov/incidents/rss.xml"
SOURCE_URL = "https://inciweb.wildfire.gov/"

_SLUG_CODE = re.compile(r"/incident-information/([a-z0-9]+)-", re.IGNORECASE)
_TITLE_CODE = re.compile(r"^([A-Z0-9]{2,6})\s+(.+)$", re.DOTALL)
_LAST_UPDATED = re.compile(r"Last updated:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})")


class InciwebItem(BaseModel):
    """One RSS item — the internal join candidate for a WFIGS incident."""

    code: str  # leading incident code, e.g. "ORMHF"; "" when unparseable (join-safe)
    name: str  # title minus the code, e.g. "Austin Fire"
    title: str
    link: str
    summary: str  # cleaned "Incident Overview" text
    lastUpdated: str | None = None  # "Last updated: 2026-09-03" from the description
    publishedAt: str | None = None  # RSS pubDate passed through
    guid: str | None = None


def norm_name(value: str) -> str:
    """Fold a fire name for matching: lowercase, punctuation -> space, squeeze."""
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", value.lower()).split())


def split_title(title: str, link: str) -> tuple[str, str]:
    """("ORMHF Austin Fire", link) -> ("ORMHF", "Austin Fire"); unprefixed -> ("", title)."""
    clean = title.strip()
    code = ""
    slug_match = _SLUG_CODE.search(link or "")
    if slug_match:
        code = slug_match.group(1).upper()
    else:
        title_match = _TITLE_CODE.match(clean)
        if title_match:
            code = title_match.group(1)
    if not code:
        return "", clean
    name = re.sub(rf"^{re.escape(code)}\s+", "", clean, flags=re.IGNORECASE).strip()
    return code, name or clean


def parse_summary(raw: str | None) -> tuple[str, str | None]:
    """RSS description -> (overview text, last-updated date).

    Descriptions are '---'-separated blocks ending in "Incident Overview: ..." and
    carry HTML entities (e.g. &nbsp;); tolerate missing blocks and stray whitespace.
    """
    if not raw:
        return "", None
    text = unescape(raw).strip()
    updated = _LAST_UPDATED.search(text)
    marker = "Incident Overview:"
    idx = text.find(marker)
    overview = text[idx + len(marker) :] if idx >= 0 else text
    return re.sub(r"\s+", " ", overview).strip(), updated.group(1) if updated else None


def parse_items(xml_text: str) -> list[InciwebItem]:
    """Parse the incidents RSS feed; malformed XML raises (degrades to failed)."""
    root = ElementTree.fromstring(xml_text)
    items: list[InciwebItem] = []
    for node in root.iter("item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        summary, last_updated = parse_summary(node.findtext("description"))
        code, name = split_title(title, link)
        items.append(
            InciwebItem(
                code=code,
                name=name,
                title=title,
                link=link,
                summary=summary,
                lastUpdated=last_updated,
                publishedAt=node.findtext("pubDate"),
                guid=node.findtext("guid"),
            )
        )
    return items


def find_item(incident_name: str, items: list[InciwebItem]) -> InciwebItem | None:
    """Join by normalized incident name; items without a code never match."""
    target = norm_name(incident_name)
    if not target:
        return None
    for item in items:
        if item.code and norm_name(item.name) == target:
            return item
    return None


async def fetch_items(client: httpx.AsyncClient | None = None) -> list[InciwebItem]:
    """Fetch and parse the national incident RSS feed."""
    response = await (client or get_http_client()).get(RSS_URL)
    response.raise_for_status()
    return parse_items(response.text)
