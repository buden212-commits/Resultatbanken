"""Parse participant names from plain-text result files."""

from __future__ import annotations

import re
from pathlib import Path

from .common import ResultRow, detect_status, make_row, split_team_names

PLACED_LINE = re.compile(
    r"^\s*(\d+)[\.\)]\s+(.+?)\s+([\d]+[\.:,][\d]{2}(?:[\.:,][\d]{2})?)\s*$"
)
SIMPLE_LINE = re.compile(r"^\s*(\d+)[\.\)]\s+(.+?)\s+([\d:,\.]+)\s*$")
CLASS_HEADER = re.compile(
    r"^(Korta|Mellan|Långa|Nybörjar|Vit|Orange|Röd|Blå|Grön|H\d+|D\d+|Open).*$",
    re.I,
)


def parse_text_file(path: Path, event_id: int) -> list[ResultRow]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rows: list[ResultRow] = []
    current_class: str | None = None

    for line in text.splitlines():
        if CLASS_HEADER.match(line.strip()):
            current_class = line.strip()
            continue

        status = detect_status(line)
        if status and not re.match(r"^\s*\d+", line):
            for name in split_team_names(line):
                row = make_row(
                    event_id,
                    name,
                    class_name=current_class,
                    status=status,
                    parse_source="text",
                    parse_confidence="medium",
                )
                if row:
                    rows.append(row)
            continue

        match = PLACED_LINE.match(line) or SIMPLE_LINE.match(line)
        if not match:
            continue

        place = int(match.group(1))
        names_blob = match.group(2)
        time_text = match.group(3).replace(",", ".")

        for name in split_team_names(names_blob):
            row = make_row(
                event_id,
                name,
                class_name=current_class,
                place=place,
                time=time_text,
                parse_source="text",
                parse_confidence="medium",
            )
            if row:
                rows.append(row)

    return rows
