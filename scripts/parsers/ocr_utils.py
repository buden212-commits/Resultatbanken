"""OCR helpers for scanned PDFs and result photos."""

from __future__ import annotations

import io
import os
import shutil
from pathlib import Path

OCR_MIN_TEXT = 20
OCR_DPI = 200
OCR_LANG = os.environ.get("TESSERACT_LANG", "eng")


def find_tesseract() -> str | None:
    env = os.environ.get("TESSERACT_CMD")
    if env and Path(env).exists():
        return env

    found = shutil.which("tesseract")
    if found:
        return found

    for candidate in (
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        Path.home() / "AppData/Local/Programs/Tesseract-OCR/tesseract.exe",
    ):
        if candidate.exists():
            return str(candidate)
    return None


def ocr_available() -> bool:
    return find_tesseract() is not None


def ocr_image_bytes(image_bytes: bytes) -> str:
    import pytesseract
    from PIL import Image, ImageFile

    ImageFile.LOAD_TRUNCATED_IMAGES = True
    cmd = find_tesseract()
    if cmd is None:
        return ""
    pytesseract.pytesseract.tesseract_cmd = cmd

    image = Image.open(io.BytesIO(image_bytes))
    return pytesseract.image_to_string(image, lang=OCR_LANG, config="--psm 6")


def ocr_image_file(path: Path) -> str:
    return ocr_image_bytes(path.read_bytes())


def ocr_pdf_file(path: Path) -> str:
    try:
        import fitz
    except ImportError:
        return ""

    if not ocr_available():
        return ""

    parts: list[str] = []
    document = fitz.open(path)
    try:
        for page in document:
            pixmap = page.get_pixmap(dpi=OCR_DPI)
            parts.append(ocr_image_bytes(pixmap.tobytes("png")))
    finally:
        document.close()

    return "\n".join(parts)
