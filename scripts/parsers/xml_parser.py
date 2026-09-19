"""Parse Eventor ResultList and IOF XML 3.0 ResultList into ResultRow."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional

from .common import ResultRow, make_row

STATUS_MAP = {
    "ok": None,
    "inactive": "dns",
    "didnotstart": "dns",
    "didnotfinish": "dnf",
    "mispunch": "felst",
    "missingpunch": "felst",
    "disqualified": "felst",
    "overtime": "felst",
    "cancelled": "dns",
    "notcompeting": "deltagit",
}


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _child(el: ET.Element, *names: str) -> Optional[ET.Element]:
    current: Optional[ET.Element] = el
    for name in names:
        if current is None:
            return None
        found = None
        for child in current:
            if _local(child.tag) == name:
                found = child
                break
        current = found
    return current


def _text(el: Optional[ET.Element], *names: str) -> str:
    target = _child(el, *names) if names else el
    if target is None:
        return ""
    return (target.text or "").strip()


def _attr_status(result: ET.Element) -> str:
    for child in result:
        if _local(child.tag) == "CompetitorStatus":
            return (child.attrib.get("value") or (child.text or "")).strip()
        if _local(child.tag) == "Status":
            return (child.text or child.attrib.get("value") or "").strip()
    return ""


def _map_status(raw: str) -> Optional[str]:
    if not raw:
        return None
    return STATUS_MAP.get(raw.replace(" ", "").lower(), raw.lower())


def _format_seconds(raw: str) -> Optional[str]:
    text = raw.strip()
    if not text:
        return None
    if ":" in text:
        return text
    try:
        total = int(float(text))
    except ValueError:
        return text
    if total < 0:
        return None
    hours, rem = divmod(total, 3600)
    minutes, seconds = divmod(rem, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def _person_name(person: ET.Element) -> str:
    given = _text(person, "PersonName", "Given") or _text(person, "Name", "Given")
    family = _text(person, "PersonName", "Family") or _text(person, "Name", "Family")
    if given or family:
        return f"{given} {family}".strip()
    return _text(person, "Name") or _text(person, "PersonName")


def _class_name(class_result: ET.Element) -> Optional[str]:
    name = (
        _text(class_result, "EventClass", "Name")
        or _text(class_result, "EventClass", "ClassShortName")
        or _text(class_result, "Class", "Name")
        or _text(class_result, "Class", "ShortName")
    )
    return name or None


def parse_xml_file(path: Path, event_id: int) -> list[ResultRow]:
    root = ET.parse(path).getroot()
    if _local(root.tag) != "ResultList":
        return []

    rows: list[ResultRow] = []
    for class_result in root:
        if _local(class_result.tag) != "ClassResult":
            continue
        class_name = _class_name(class_result)

        for person_result in class_result:
            if _local(person_result.tag) != "PersonResult":
                continue
            person = _child(person_result, "Person")
            if person is None:
                continue
            name = _person_name(person)
            org = _child(person_result, "Organisation")
            club = (
                _text(org, "ShortName")
                or _text(org, "Name")
                or _text(org, "MediaName")
                or None
            )

            result = _child(person_result, "Result")
            if result is None:
                continue

            status_raw = _attr_status(result)
            status = _map_status(status_raw)
            time_raw = _text(result, "Time")
            time = _format_seconds(time_raw) if time_raw else None
            if status is None and not time:
                status = "deltagit"

            place_raw = _text(result, "ResultPosition") or _text(result, "Position")
            place: Optional[int] = None
            if place_raw.isdigit():
                place = int(place_raw)

            row = make_row(
                event_id,
                name,
                club=club,
                class_name=class_name,
                place=place if status is None else None,
                time=time if status is None else None,
                status=status,
                parse_source="xml_eventor",
                parse_confidence="high",
            )
            if row:
                rows.append(row)

    return rows
