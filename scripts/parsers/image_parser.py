"""Parse participant names from JPEG/PNG result photos via OCR."""

from __future__ import annotations

from pathlib import Path

from .ocr_utils import ocr_available, ocr_image_file
from .pdf_parser import parse_pdf_text


def parse_image_file(path: Path, event_id: int) -> list:
    if not ocr_available():
        return []

    text = ocr_image_file(path)
    if len(text.strip()) < 10:
        return []

    return parse_pdf_text(text, event_id, parse_source="image-ocr", parse_confidence="low")
