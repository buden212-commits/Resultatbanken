"""HTTP helpers for downloading Resultatbanken data."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

import requests

MIME_TO_EXTENSION = {
    "application/msword": ".doc",
    "application/vnd.ms-excel": ".xls",
    "application/x-msexcel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.oasis.opendocument.spreadsheet": ".ods",
    "application/rtf": ".rtf",
    "text/rtf": ".rtf",
}

BASE_URL = "https://www2.ifkmora.se/ok/web/kavlar"
DEFAULT_TIMEOUT = 120
RETRY_DELAYS = (5, 15, 45)
USER_AGENT = (
    "ResultatbankenExporter/1.0 (+https://www2.ifkmora.se/ok/web/kavlar/resultatbanken.asp)"
)


def create_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session


def fetch_with_retry(
    session: requests.Session,
    url: str,
    *,
    timeout: int = DEFAULT_TIMEOUT,
    method: str = "GET",
) -> requests.Response:
    last_error: Optional[Exception] = None

    for attempt, delay in enumerate(RETRY_DELAYS, start=1):
        try:
            response = session.request(method, url, timeout=timeout)
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_error = exc
            if attempt < len(RETRY_DELAYS):
                time.sleep(delay)

    assert last_error is not None
    raise last_error


def extension_from_filename(filename: str) -> str:
    if not filename:
        return ""
    return Path(filename).suffix.lower()


def detect_extension(
    content: bytes,
    content_type_header: str = "",
    metadata_file_type: str = "",
    result_filename: str = "",
) -> str:
    header = (content_type_header or "").lower().split(";")[0].strip()
    metadata = (metadata_file_type or "").lower().split(";")[0].strip()
    manifest_ext = extension_from_filename(result_filename)

    if content.startswith(b"%PDF") or "pdf" in header or "pdf" in metadata:
        return ".pdf"

    if content.lstrip().startswith((b"<!DOCTYPE", b"<html", b"<HTML", b"<body", b"<BODY")):
        return ".html"

    if header.startswith("text/plain") or metadata.startswith("text/plain"):
        return ".txt"

    if content.lstrip().startswith(b"{\\rtf"):
        return ".rtf"

    if content[:4] == b"\xD0\xCF\x11\xE0":
        if manifest_ext in {".doc", ".xls", ".ppt"}:
            return manifest_ext
        for mime in (header, metadata):
            if mime in MIME_TO_EXTENSION:
                return MIME_TO_EXTENSION[mime]
        return ".doc"

    if content[:2] == b"PK":
        if manifest_ext in {".xlsx", ".docx", ".xlsm", ".ods", ".odt", ".pptx"}:
            return manifest_ext
        for mime in (header, metadata):
            if mime in MIME_TO_EXTENSION:
                return MIME_TO_EXTENSION[mime]
        return ".zip"

    if content.lstrip().startswith(b"<?xml") and b"Excel.Sheet" in content[:500]:
        return manifest_ext if manifest_ext in {".xls", ".xml"} else ".xml"

    if "html" in header or "html" in metadata:
        return ".html"

    if "text" in header or "text" in metadata:
        return ".txt"

    for mime in (header, metadata):
        if mime in MIME_TO_EXTENSION:
            return MIME_TO_EXTENSION[mime]

    unknown_types = {"", "application/octet-stream"}
    if manifest_ext and (header in unknown_types or metadata in unknown_types):
        return manifest_ext

    if manifest_ext in {
        ".doc",
        ".xls",
        ".xlsx",
        ".docx",
        ".rtf",
        ".ods",
        ".ppt",
        ".pptx",
    }:
        return manifest_ext

    return ".bin"


def decode_text(content: bytes) -> str:
    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def result_url(event_id: int) -> str:
    return f"{BASE_URL}/Getresultat.asp?id={event_id}"


def sok_url(page: int) -> str:
    return f"{BASE_URL}/sok.asp?page={page}"
