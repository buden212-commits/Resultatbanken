"""Detect actual file type from content bytes."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scraper"))

from fetch import detect_extension  # noqa: E402

SUPPORTED = {
    ".pdf",
    ".html",
    ".htm",
    ".txt",
    ".xls",
    ".xlsx",
    ".xlsm",
    ".ods",
    ".doc",
    ".docx",
    ".rtf",
    ".jpeg",
    ".jpg",
    ".png",
}


def effective_suffix(path: Path, manifest_entry: dict | None = None) -> str:
    content = path.read_bytes()
    entry = manifest_entry or {}
    detected = detect_extension(
        content,
        metadata_file_type=entry.get("file_type", ""),
        result_filename=entry.get("result_file", "") or path.name,
    )
    if detected != ".bin" and detected in SUPPORTED:
        return detected
    return path.suffix.lower()


def resolve_parser_suffix(path: Path, manifest_entry: dict | None = None) -> str:
    suffix = path.suffix.lower()
    if suffix in SUPPORTED:
        return suffix
    detected = effective_suffix(path, manifest_entry)
    return detected if detected in SUPPORTED else suffix
