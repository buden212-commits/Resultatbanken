#!/usr/bin/env python3
"""Rename downloaded .bin files using manifest metadata and magic bytes."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "scraper"))

from fetch import detect_extension  # noqa: E402

CONTENT_DIR = ROOT_DIR / "data" / "content"
MANIFEST_PATH = ROOT_DIR / "data" / "manifest.json"


def main() -> int:
    if not MANIFEST_PATH.exists():
        print(f"Hittade inte {MANIFEST_PATH}", file=sys.stderr)
        return 1

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    by_id = {entry["id"]: entry for entry in manifest}
    renamed = 0
    skipped = 0

    for path in sorted(CONTENT_DIR.glob("*.bin"), key=lambda item: int(item.stem)):
        event_id = int(path.stem)
        entry = by_id.get(event_id, {})
        content = path.read_bytes()
        extension = detect_extension(
            content,
            metadata_file_type=entry.get("file_type", ""),
            result_filename=entry.get("result_file", ""),
        )

        if extension == ".bin":
            print(f"  Hoppar över id={event_id}: kunde inte avgöra filtyp")
            skipped += 1
            continue

        target = path.with_suffix(extension)
        if target.exists() and target != path:
            print(f"  Hoppar över id={event_id}: {target.name} finns redan")
            skipped += 1
            continue

        path.rename(target)
        entry["local_file"] = f"content/{target.name}"
        renamed += 1
        print(f"  id={event_id}: {path.name} -> {target.name}")

    manifest = [by_id.get(entry["id"], entry) for entry in manifest]
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("")
    print(f"Klart. Bytte namn på {renamed} filer, hoppade över {skipped}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
