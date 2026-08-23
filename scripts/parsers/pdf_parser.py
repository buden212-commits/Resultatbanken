"""Parse participant names from PDF result files."""

from __future__ import annotations

import re
from pathlib import Path

from .common import ResultRow, detect_status, make_row, split_team_names
from .ocr_utils import OCR_MIN_TEXT, ocr_available, ocr_pdf_file

EVENTOR_LINE = re.compile(
    r"^(\d+)\s+(.+?)\s+IFK\s+Mora(?:s)?(?:\s+OK)?\s+([\d:+]+(?:\s*\+\s*[\d:+]+)?)\s*$",
    re.I,
)
SIMPLE_LINE = re.compile(
    r"^(\d+)[\.\)]\s+([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö'\-\s&]+?)\s+([\d]+[:\.,][\d]{2}(?:[:\.,][\d]{2})?)\s*$"
)
TRAINING_LINE = re.compile(
    r"^(\d+)\s+(.+?)\s+([\d]+[:\.,\-][\d]{2}(?:[:\.,\-][\d]{2})?)\s*$"
)
TABLE_BAN_LINE = re.compile(
    r"^([A-Z])\s+(\d+)\s+(.+?)\s+([\d]+[:\.,][\d]{2}(?:[:\.,][\d]{2})?)\s*$"
)
SYLVESTER_LINE = re.compile(
    r"^(\d+)\.\s*(.+?)\s+([\d:]+\.?[\d]*(?:\s*[\(\[][\d:\.\-\s]+[\)\]])?(?:\s+[\d:\.\-]+)?)\s*$"
)
NAME_TIME_LINE = re.compile(
    r"^([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö'\-\s]+?)\s+([\d]+[.,][\d]{2})\s*$"
)
CLASS_RESULT_LINE = re.compile(
    r"^(Nybörjare|Korta|Mellan|Långa|Vit|Orange|Röd|Blå|Grön|H\d+|D\d+).+\s+km\s+(.+?)\s+([\d]+[.,][\d]{2})\s*$",
    re.I,
)
SKINKLOPP_LINE = re.compile(
    r"^(\d+)\s+([A-Z])\s+(.+?)\s+[\d.]+\s+[\d.]+\s+[+-][\d.,]+\s*$"
)
HANDICAP_LINE = re.compile(
    r"^(\d+)\s+([A-Z0-9*]+)\s+([A-Za-zÅÄÖåäö].+?)\s+[\d.]+\s"
)
KANOT_LINE = re.compile(
    r"^(ungdom|mix|vuxen|kategori)\s+(\d+)\s+(.+?)\s+\d{1,2}:\d{2}",
    re.I,
)
CLASS_LINE = re.compile(
    r"^(Vit|Orange|Röd|Blå|Grön|Violett|Gul|Svart|Lila|H\d+|D\d+|Korta?|Mellan|L[åa]ng(?:a)?|Nybörjare?|Bana\s+[A-Z]|"
    r"Herrar|Damer|\d+\s+varv|Motions-OL).*",
    re.I,
)
BANA_HEADER_LINE = re.compile(
    r"^[A-Za-zÅÄÖåäö''\-]+\s+bana\s+.+\s*km\s*$",
    re.I,
)
SKIP_LINE = re.compile(
    r"^(Tabelle|Seite|Plac|Klass|Namn|tid|Arrang|Resultat|Handicap|Uppsnappade|Visdomsord|Tack\b|"
    r"Område|Plac\.|Bana Placering|Kategorie Placering|Delt:|SKERIOL|KARTA)",
    re.I,
)


def parse_pdf_file(path: Path, event_id: int) -> list[ResultRow]:
    text = _extract_pdf_text(path)
    rows = parse_pdf_text(text, event_id, parse_source="pdf-text", parse_confidence="medium")

    if rows:
        return rows

    if len(text.strip()) >= OCR_MIN_TEXT:
        return []

    if not ocr_available():
        return []

    ocr_text = ocr_pdf_file(path)
    if len(ocr_text.strip()) < 10:
        return []

    return parse_pdf_text(ocr_text, event_id, parse_source="pdf-ocr", parse_confidence="low")


def _extract_pdf_text(path: Path) -> str:
    try:
        import pdfplumber
    except ImportError:
        return ""

    with pdfplumber.open(path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def parse_pdf_text(
    text: str,
    event_id: int,
    *,
    parse_source: str = "pdf-text",
    parse_confidence: str = "medium",
) -> list[ResultRow]:
    if len(text.strip()) < 10:
        return []

    rows: list[ResultRow] = []
    current_class: str | None = None

    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line.strip())
        if not line or SKIP_LINE.match(line):
            continue

        if BANA_HEADER_LINE.match(line):
            current_class = line.strip()
            continue

        if CLASS_LINE.match(line):
            current_class = line.strip()
            class_match = CLASS_RESULT_LINE.match(line)
            if class_match:
                current_class = class_match.group(1)
                row = _make_result_row(
                    event_id,
                    class_match.group(2),
                    current_class,
                    time_text=class_match.group(3),
                    parse_source=parse_source,
                    parse_confidence=parse_confidence,
                )
                if row:
                    rows.append(row)
            continue

        status = detect_status(line)
        if status and not re.match(r"^\d", line):
            for name in split_team_names(line):
                row = make_row(
                    event_id,
                    name,
                    class_name=current_class,
                    status=status,
                    parse_source=parse_source,
                    parse_confidence=parse_confidence,
                )
                if row:
                    rows.append(row)
            continue

        for part in _split_packed_lines(line):
            parsed = _parse_result_line(
                event_id,
                part,
                current_class,
                status,
                parse_source=parse_source,
                parse_confidence=parse_confidence,
            )
            if parsed:
                rows.append(parsed)

    return rows


def _split_packed_lines(line: str) -> list[str]:
    if len(re.findall(r"\d+\.", line)) < 2:
        return [line]
    parts = [part.strip() for part in re.split(r"(?<=\d:\d{2})\s+(?=\d+\.)", line) if part.strip()]
    if len(parts) > 1:
        return parts
    parts = [part.strip() for part in re.split(r"(?<=\))\s+(?=\d+\.)", line) if part.strip()]
    return parts if len(parts) > 1 else [line]


def _make_result_row(
    event_id: int,
    name: str,
    class_name: str | None,
    *,
    place: int | None = None,
    time_text: str | None = None,
    status: str | None = None,
    parse_source: str = "pdf-text",
    parse_confidence: str = "medium",
) -> ResultRow | None:
    time_value = time_text.replace(",", ".") if time_text else None
    return make_row(
        event_id,
        name,
        class_name=class_name,
        place=place,
        time=None if status else time_value,
        status=status,
        parse_source=parse_source,
        parse_confidence=parse_confidence,
    )


def _parse_result_line(
    event_id: int,
    line: str,
    current_class: str | None,
    status: str | None,
    *,
    parse_source: str,
    parse_confidence: str,
) -> ResultRow | None:
    for pattern, handler in (
        (TABLE_BAN_LINE, _from_table_ban),
        (SKINKLOPP_LINE, _from_skinklopp),
        (HANDICAP_LINE, _from_handicap),
        (KANOT_LINE, _from_kanot),
        (SYLVESTER_LINE, _from_sylvester),
        (EVENTOR_LINE, _from_standard),
        (SIMPLE_LINE, _from_standard),
        (TRAINING_LINE, _from_standard),
        (NAME_TIME_LINE, _from_name_time),
    ):
        match = pattern.match(line)
        if match:
            return handler(
                event_id,
                match,
                current_class,
                status,
                parse_source=parse_source,
                parse_confidence=parse_confidence,
            )
    return None


def _from_table_ban(
    event_id: int,
    match: re.Match[str],
    current_class: str | None,
    status: str | None,
    *,
    parse_source: str,
    parse_confidence: str,
) -> ResultRow | None:
    course, place, name, time_text = match.groups()
    class_name = f"{course} {current_class}" if current_class else course
    return _make_result_row(
        event_id,
        name,
        class_name,
        place=int(place),
        time_text=time_text,
        status=status,
        parse_source=parse_source,
        parse_confidence=parse_confidence,
    )


def _from_skinklopp(
    event_id: int,
    match: re.Match[str],
    current_class: str | None,
    status: str | None,
    *,
    parse_source: str,
    parse_confidence: str,
) -> ResultRow | None:
    place, course, name = match.groups()
    class_name = f"{course} {current_class}" if current_class else course
    return _make_result_row(
        event_id,
        name,
        class_name,
        place=int(place),
        status=status,
        parse_source=parse_source,
        parse_confidence=parse_confidence,
    )


def _from_handicap(
    event_id: int,
    match: re.Match[str],
    current_class: str | None,
    status: str | None,
    *,
    parse_source: str,
    parse_confidence: str,
) -> ResultRow | None:
    place, class_code, name = match.groups()
    class_name = class_code if not current_class else current_class
    return _make_result_row(
        event_id,
        name,
        class_name,
        place=int(place),
        status=status,
        parse_source=parse_source,
        parse_confidence=parse_confidence,
    )


def _from_kanot(
    event_id: int,
    match: re.Match[str],
    current_class: str | None,
    status: str | None,
    *,
    parse_source: str,
    parse_confidence: str,
) -> ResultRow | None:
    category, place, names_blob = match.groups()
    class_name = category if not current_class else current_class
    for name in split_team_names(names_blob):
        row = _make_result_row(
            event_id,
            name,
            class_name,
            place=int(place),
            status=status,
            parse_source=parse_source,
            parse_confidence=parse_confidence,
        )
        if row:
            return row
    return None


def _from_sylvester(
    event_id: int,
    match: re.Match[str],
    current_class: str | None,
    status: str | None,
    *,
    parse_source: str,
    parse_confidence: str,
) -> ResultRow | None:
    place, name, time_text = match.groups()
    if name.lower() == "kea":
        name = "KEA"
    return _make_result_row(
        event_id,
        name,
        current_class,
        place=int(place),
        time_text=time_text,
        status=status,
        parse_source=parse_source,
        parse_confidence=parse_confidence,
    )


def _from_standard(
    event_id: int,
    match: re.Match[str],
    current_class: str | None,
    status: str | None,
    *,
    parse_source: str,
    parse_confidence: str,
) -> ResultRow | None:
    place, name, time_text = match.groups()
    return _make_result_row(
        event_id,
        name,
        current_class,
        place=int(place),
        time_text=time_text,
        status=status,
        parse_source=parse_source,
        parse_confidence=parse_confidence,
    )


def _from_name_time(
    event_id: int,
    match: re.Match[str],
    current_class: str | None,
    status: str | None,
    *,
    parse_source: str,
    parse_confidence: str,
) -> ResultRow | None:
    name, time_text = match.groups()
    return _make_result_row(
        event_id,
        name,
        current_class,
        time_text=time_text,
        status=status,
        parse_source=parse_source,
        parse_confidence=parse_confidence,
    )
