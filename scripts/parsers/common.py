"""Shared types and helpers for participant extraction."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass, field
from typing import Any, Optional


STATUS_PATTERNS = (
    (re.compile(r"ej\s+start|dns", re.I), "dns"),
    (re.compile(r"ej\s+godk|felst|felstämplat|mp\b", re.I), "felst"),
    (re.compile(r"\bdnf\b|gick\s+inte\s+i\s+mål", re.I), "dnf"),
    (re.compile(r"deltagit|deltog|utom\s+tävlan", re.I), "deltagit"),
)


@dataclass
class ResultRow:
    event_id: int
    name: str
    person_key: str
    club: Optional[str] = None
    class_name: Optional[str] = None
    place: Optional[int] = None
    time: Optional[str] = None
    status: Optional[str] = None
    parse_source: str = ""
    parse_confidence: str = "medium"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


NAME_WORD = re.compile(
    r"^[A-ZÅÄÖ][a-zåäö'\-]*(?:-[A-ZÅÄÖ][a-zåäö'\-]+)?$",
)
TIME_TOKEN = re.compile(
    r"^\d+[:.,]\d+(?:[:.,]\d+)?$|^\d+[.,]\d+$",
)
CLUB_SUFFIX_PATTERNS = (
    re.compile(r"\s+IFK\s+Mora(?:\s+OK)?\s*$", re.I),
    re.compile(r"\s+IFK\s+[\wåäöÅÄÖ'./-]+(?:\s+OK)?\s*$", re.I),
    re.compile(r"\s+[\wåäöÅÄÖ'./-]+\s+IF(?:\s+)?OK\s*$", re.I),
    re.compile(r"\s+[\wåäöÅÄÖ'./-]+\s+OK\s*$", re.I),
    re.compile(r"\s+[\wåäöÅÄÖ'./-]+\s+(?:SK|BK|FK|IK)(?:\s+[\wåäöÅÄÖ'./-]+)?\s*$", re.I),
)
TRAILING_TIME_SUFFIX = re.compile(
    r"(?:\s+\d+[:.,]\d+(?:[:.,]\d+)?)+"
    r"|(?:\s+\d+[.,]\d+)+"
    r"\s*$",
)


def person_key(name: str) -> str:
    name = clean_name(name)
    normalized = unicodedata.normalize("NFD", name.strip().lower())
    without_marks = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    slug = re.sub(r"[^a-z0-9]+", "-", without_marks)
    return slug.strip("-")


def _strip_trailing_times(name: str) -> str:
    previous = None
    while name != previous:
        previous = name
        name = TRAILING_TIME_SUFFIX.sub("", name)
        name = re.sub(r"\s*\([^)]*\)\s*", " ", name)
        words = name.split()
        while words and TIME_TOKEN.match(words[-1]):
            words.pop()
        name = " ".join(words)
    return name


def _strip_trailing_club(name: str) -> str:
    previous = None
    while name != previous:
        previous = name
        for pattern in CLUB_SUFFIX_PATTERNS:
            name = pattern.sub("", name)
        words = name.split()
        if words and words[-1].lower() in {"ok", "sk", "bk", "fk", "ik", "if"}:
            words.pop()
            while words and words[-1].lower() == "ifk":
                words.pop()
            while words and not NAME_WORD.match(words[-1]):
                words.pop()
            name = " ".join(words)
    return name


def extract_canonical_name(name: str) -> str:
    words = name.split()
    if not words:
        return ""

    name_words: list[str] = []
    for word in words:
        if NAME_WORD.match(word):
            name_words.append(word)
            continue
        break

    if len(name_words) >= 2:
        return " ".join(name_words[:4])
    if name_words:
        return name_words[0]
    return " ".join(words[:3])


def clean_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name.strip())
    name = re.sub(r"^\d+\.\s*", "", name)
    name = _strip_trailing_times(name)
    name = _strip_trailing_club(name)
    name = extract_canonical_name(name)
    return name.strip(" ,.\t")


def detect_status(text: str) -> Optional[str]:
    for pattern, status in STATUS_PATTERNS:
        if pattern.search(text):
            return status
    return None


def is_plausible_name(name: str) -> bool:
    if not name or len(name) < 3:
        return False
    if re.fullmatch(r"[\d\s\.:,+-]+", name):
        return False
    lowered = name.lower()
    skip = {
        "resultat",
        "arrangör",
        "arrangörer",
        "funktionärer",
        "förhållanden",
        "plac",
        "namn",
        "tid",
        "klass",
        "klubb",
        "totalt",
        "summa",
    }
    if lowered in skip:
        return False
    if not re.search(r"[A-Za-zÅÄÖåäö]", name):
        return False
    return True


def split_team_names(raw: str) -> list[str]:
    parts = re.split(r",|\boch\b", raw, flags=re.I)
    names: list[str] = []
    for part in parts:
        candidate = clean_name(part)
        if is_plausible_name(candidate):
            names.append(candidate)
    return names


def make_row(
    event_id: int,
    name: str,
    *,
    club: Optional[str] = None,
    class_name: Optional[str] = None,
    place: Optional[int] = None,
    time: Optional[str] = None,
    status: Optional[str] = None,
    parse_source: str,
    parse_confidence: str = "medium",
) -> Optional[ResultRow]:
    name = clean_name(name)
    if not is_plausible_name(name):
        return None
    return ResultRow(
        event_id=event_id,
        name=name,
        person_key=person_key(name),
        club=club,
        class_name=class_name,
        place=place,
        time=time,
        status=status,
        parse_source=parse_source,
        parse_confidence=parse_confidence,
    )
