"""Parse participant names from HTML result files."""

from __future__ import annotations

import re
from pathlib import Path

from bs4 import BeautifulSoup

from .common import ResultRow, detect_status, make_row, split_team_names

OE_LINE = re.compile(
    r"^\s*(\d+)?\s*\d*\s+([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö'\-\s]+?)\s+\d*\s+\d*\s+([A-Za-zÅÄÖåäö].+?)\s+([A-Z]\d+|D\d+|H\d+|Open)\s+([\d:]+|Ej godk.*|DNS.*)",
    re.I,
)
OE2003_PRE_CLASS = re.compile(r"^([HD]\d+|D\d+|Open|M\d+|K\d+|L\d+).*$", re.I)
OE2003_PRE_LINE = re.compile(
    r"^(?:(\d+)\s+)?\d+\s+([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö'\-\s]+?)\s+(?:\d+\s+)?\d+\s+IFK\s+Moras?\s+OK\s+(.+?)\s*$",
    re.I,
)
OE2003_SPLIT_LINE = re.compile(
    r"<font[^>]*><b>\s*(\d+)\s*</b></font>\s*<font[^>]*><b>\s*(\d+)\s*</b></font>\s*"
    r"<font[^>]*><b>([A-Za-zÅÄÖåäö][^<]+?)\s*</b></font>\s+([HD]\d+)\s+"
    r"<font[^>]*><b>\s*([\d:]+)</b>",
    re.I,
)


def parse_html_file(path: Path, event_id: int) -> list[ResultRow]:
    content = path.read_bytes()
    soup = BeautifulSoup(content, "html.parser", from_encoding="windows-1252")
    text = soup.get_text("\n")

    if "MeOS" in text or soup.find("td", class_=re.compile(r"^e[01]$")):
        return _parse_meos(soup, event_id)

    if "OE2003" in text or "sportsoftware" in text.lower():
        pre_rows = _parse_oe2003_pre(text, event_id)
        if pre_rows:
            return pre_rows
        split_rows = _parse_oe2003_splits(content, event_id)
        if split_rows:
            return split_rows
        return _parse_oe2003(text, event_id)

    return _parse_generic_table(soup, event_id)


def _parse_meos(soup: BeautifulSoup, event_id: int) -> list[ResultRow]:
    rows: list[ResultRow] = []
    current_class: str | None = None

    for tr in soup.find_all("tr"):
        header = tr.find("td", class_="header")
        if header:
            bold = header.find("b")
            if bold:
                label = bold.get_text(" ", strip=True)
                if re.match(r"^[HD]\d+|Open|M\d+|K\d+|L\d+|Vit|Orange|Röd|Blå", label, re.I):
                    current_class = label
            continue

        cells = tr.find_all("td")
        if len(cells) < 2:
            continue

        first = cells[0].get_text(" ", strip=True)
        if not re.match(r"^\d+\.?$", first):
            status_text = " ".join(cell.get_text(" ", strip=True) for cell in cells)
            status = detect_status(status_text)
            if status and len(cells) >= 2:
                name = cells[1].get_text(" ", strip=True)
                row = make_row(
                    event_id,
                    name,
                    club=cells[2].get_text(" ", strip=True) if len(cells) > 2 else None,
                    class_name=current_class,
                    status=status,
                    parse_source="html-meos",
                    parse_confidence="high",
                )
                if row:
                    rows.append(row)
            continue

        place = int(re.sub(r"\D", "", first) or "0") or None
        name = cells[1].get_text(" ", strip=True)
        club = cells[2].get_text(" ", strip=True) if len(cells) > 2 else None
        time_text = cells[3].get_text(" ", strip=True) if len(cells) > 3 else None
        status = detect_status(time_text or "")

        row = make_row(
            event_id,
            name,
            club=club,
            class_name=current_class,
            place=place,
            time=None if status else time_text,
            status=status,
            parse_source="html-meos",
            parse_confidence="high",
        )
        if row:
            rows.append(row)

    return rows


def _parse_oe2003_pre(text: str, event_id: int) -> list[ResultRow]:
    rows: list[ResultRow] = []
    current_class: str | None = None

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        if OE2003_PRE_CLASS.match(line):
            current_class = line.split()[0]
            continue

        match = OE2003_PRE_LINE.match(line)
        if not match:
            continue

        place_raw, name, time_text = match.groups()
        status = detect_status(time_text)
        row = make_row(
            event_id,
            name,
            class_name=current_class,
            place=int(place_raw) if place_raw else None,
            time=None if status else time_text.strip(),
            status=status,
            parse_source="html-oe2003-pre",
            parse_confidence="high",
        )
        if row:
            rows.append(row)

    return rows


def _parse_oe2003_splits(content: bytes, event_id: int) -> list[ResultRow]:
    html = content.decode("windows-1252", errors="replace")
    rows: list[ResultRow] = []

    for match in OE2003_SPLIT_LINE.finditer(html):
        place, _start, name, class_name, time_text = match.groups()
        row = make_row(
            event_id,
            name,
            class_name=class_name,
            place=int(place),
            time=time_text.strip(),
            parse_source="html-oe2003-split",
            parse_confidence="high",
        )
        if row:
            rows.append(row)

    return rows


def _parse_oe2003(text: str, event_id: int) -> list[ResultRow]:
    rows: list[ResultRow] = []
    current_class: str | None = None

    for line in text.splitlines():
        class_match = re.search(r"^(Långa|Mellan|Korta|Nybörjar|Vit|Orange|Röd|Blå|Grön)\b", line, re.I)
        if class_match:
            current_class = class_match.group(1)

        match = OE_LINE.match(line)
        if not match:
            continue

        place_raw, name, club, _klass, time_text = match.groups()
        status = detect_status(time_text)
        row = make_row(
            event_id,
            name,
            club=club.strip(),
            class_name=current_class or _klass,
            place=int(place_raw) if place_raw else None,
            time=None if status else time_text,
            status=status,
            parse_source="html-oe2003",
            parse_confidence="high",
        )
        if row:
            rows.append(row)

    return rows


def _parse_generic_table(soup: BeautifulSoup, event_id: int) -> list[ResultRow]:
    rows: list[ResultRow] = []
    current_class: str | None = None

    for tr in soup.find_all("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["td", "th"])]
        if not cells:
            continue

        if len(cells) == 1 and cells[0] and not cells[0][0].isdigit():
            current_class = cells[0]
            continue

        if len(cells) >= 2 and re.match(r"^\d+\.?$", cells[0]):
            place = int(re.sub(r"\D", "", cells[0]))
            name = cells[1]
            club = cells[2] if len(cells) > 2 else None
            time_text = cells[-1] if len(cells) > 3 else None
            status = detect_status(time_text or name)
            row = make_row(
                event_id,
                name,
                club=club,
                class_name=current_class,
                place=place,
                time=None if status else time_text,
                status=status,
                parse_source="html-generic",
                parse_confidence="medium",
            )
            if row:
                rows.append(row)

    return rows
