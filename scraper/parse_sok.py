"""Parse metadata from sok.asp listing pages."""

from __future__ import annotations

import re
from typing import Callable, Optional

from bs4 import BeautifulSoup

from fetch import fetch_with_retry, result_url, sok_url

PAGE_COUNT_PATTERN = re.compile(r"Sida\s+\d+\s+av\s+(\d+)", re.IGNORECASE)
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def decode_page_text(content: bytes) -> str:
    for encoding in ("windows-1252", "cp1252", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def parse_page_count(html: str, fallback: int = 17) -> int:
    match = PAGE_COUNT_PATTERN.search(html)
    if not match:
        return fallback
    return max(1, int(match.group(1)))


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _parse_int(value: str) -> Optional[int]:
    cleaned = _clean_text(value)
    if not cleaned:
        return None
    try:
        return int(cleaned)
    except ValueError:
        return None


def _extract_id(cells: list[str]) -> Optional[int]:
    for cell in cells:
        if cell.isdigit():
            return int(cell)
    return None


def parse_sok_html(html: str | bytes) -> list[dict]:
    if isinstance(html, bytes):
        soup = BeautifulSoup(html, "html.parser", from_encoding="windows-1252")
    else:
        soup = BeautifulSoup(html, "html.parser")
    events: list[dict] = []

    for row in soup.find_all("tr"):
        cells = [_clean_text(cell.get_text(" ", strip=True)) for cell in row.find_all(["td", "th"])]
        if len(cells) < 12:
            continue

        if cells[1].lower() == "id":
            continue

        event_id = _parse_int(cells[1]) or _extract_id(cells)
        if event_id is None:
            continue

        file_size = _parse_int(cells[9])

        events.append(
            {
                "id": event_id,
                "name": cells[11],
                "type": cells[3],
                "date": cells[4] if DATE_PATTERN.match(cells[4]) else cells[4],
                "organizer": cells[5],
                "location": cells[6],
                "free_text": cells[7],
                "result_file": cells[8],
                "file_size": file_size,
                "file_type": cells[10],
                "source_url": result_url(event_id),
            }
        )

    return events


def crawl_sok_pages(
    session,
    *,
    on_page: Optional[Callable[[int, int], None]] = None,
) -> list[dict]:
    first_response = fetch_with_retry(session, sok_url(1))
    first_html = first_response.content
    page_count = parse_page_count(decode_page_text(first_html))

    events_by_id: dict[int, dict] = {}

    def add_events(page_events: list[dict]) -> None:
        for event in page_events:
            events_by_id[event["id"]] = event

    add_events(parse_sok_html(first_html))
    if on_page:
        on_page(1, page_count)

    for page in range(2, page_count + 1):
        response = fetch_with_retry(session, sok_url(page))
        add_events(parse_sok_html(response.content))
        if on_page:
            on_page(page, page_count)

    return [events_by_id[event_id] for event_id in sorted(events_by_id)]
