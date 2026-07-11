#!/usr/bin/env python3
"""Download all Resultatbanken data from the legacy ASP site."""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from tqdm import tqdm

from fetch import (
    create_session,
    decode_text,
    detect_extension,
    fetch_with_retry,
    result_url,
)
from parse_sok import crawl_sok_pages

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
CONTENT_DIR = DATA_DIR / "content"
MANIFEST_PATH = DATA_DIR / "manifest.json"
ERRORS_PATH = DATA_DIR / "errors.json"
PROGRESS_PATH = DATA_DIR / "progress.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dirs() -> None:
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def size_matches(existing_size: int, expected_size: int | None) -> bool:
    if expected_size is None or expected_size <= 0:
        return existing_size > 0
    lower = expected_size * 0.9
    upper = expected_size * 1.1
    return lower <= existing_size <= upper


def find_existing_file(event_id: int) -> Path | None:
    matches = sorted(CONTENT_DIR.glob(f"{event_id}.*"))
    return matches[0] if matches else None


def should_skip_download(event: dict, resume: bool) -> tuple[bool, Path | None]:
    if not resume:
        return False, None

    existing = find_existing_file(event["id"])
    if existing is None:
        return False, None

    if size_matches(existing.stat().st_size, event.get("file_size")):
        return True, existing

    return False, existing


def download_event_content(session, event: dict) -> dict:
    response = fetch_with_retry(session, event["source_url"])
    content = response.content
    if not content:
        raise ValueError("Empty response body")

    extension = detect_extension(
        content,
        response.headers.get("Content-Type", ""),
        event.get("file_type", ""),
        event.get("result_file", ""),
    )

    target_path = CONTENT_DIR / f"{event['id']}{extension}"
    if extension in {".html", ".txt"}:
        target_path.write_text(decode_text(content), encoding="utf-8")
    else:
        target_path.write_bytes(content)

    event["local_file"] = f"content/{target_path.name}"
    event["downloaded_at"] = utc_now()
    return event


def build_manifest(events: list[dict]) -> list[dict]:
    manifest = []
    for event in sorted(events, key=lambda item: item["id"]):
        entry = dict(event)
        entry.setdefault("local_file", None)
        entry.setdefault("downloaded_at", None)
        manifest.append(entry)
    return manifest


def merge_manifest(existing: list[dict], fresh: list[dict]) -> list[dict]:
    merged = {item["id"]: item for item in existing}
    for event in fresh:
        previous = merged.get(event["id"], {})
        merged[event["id"]] = {**previous, **event}
    return [merged[event_id] for event_id in sorted(merged)]


def _upsert_manifest_entry(manifest: list[dict], event: dict) -> None:
    by_id = {item["id"]: item for item in manifest}
    previous = by_id.get(event["id"], {})
    by_id[event["id"]] = {**previous, **event}
    manifest.clear()
    manifest.extend(by_id[event_id] for event_id in sorted(by_id))


def fetch_metadata(session) -> list[dict]:
    print("Hämtar metadata från sok.asp ...")

    def on_page(page: int, total: int) -> None:
        print(f"  Parsade sida {page}/{total}")

    events = crawl_sok_pages(session, on_page=on_page)
    existing = load_json(MANIFEST_PATH, [])
    manifest = merge_manifest(existing, events)
    save_json(MANIFEST_PATH, manifest)
    print(f"Sparade {len(manifest)} poster i {MANIFEST_PATH}")
    return manifest


def fetch_content(
    session,
    manifest: list[dict],
    *,
    resume: bool,
    event_ids: list[int] | None = None,
    delay_seconds: float = 1.0,
) -> tuple[int, int, int]:
    ensure_dirs()
    errors = load_json(ERRORS_PATH, [])
    errors_by_id = {item["id"]: item for item in errors if "id" in item}

    selected = manifest
    if event_ids:
        wanted = set(event_ids)
        by_id = {event["id"]: event for event in manifest}
        selected = []
        for event_id in sorted(wanted):
            selected.append(
                by_id.get(
                    event_id,
                    {
                        "id": event_id,
                        "source_url": result_url(event_id),
                        "file_size": None,
                        "file_type": "",
                    },
                )
            )

    ok_count = 0
    skip_count = 0
    error_count = 0

    for event in tqdm(selected, desc="Laddar ner resultat", unit="post"):
        event_id = event["id"]

        skip, existing = should_skip_download(event, resume)
        if skip and existing is not None:
            event["local_file"] = f"content/{existing.name}"
            event.setdefault("downloaded_at", utc_now())
            errors_by_id.pop(event_id, None)
            skip_count += 1
            _upsert_manifest_entry(manifest, event)
            continue

        try:
            download_event_content(session, event)
            errors_by_id.pop(event_id, None)
            ok_count += 1
        except Exception as exc:  # noqa: BLE001 - collect and continue
            errors_by_id[event_id] = {
                "id": event_id,
                "source_url": event.get("source_url", result_url(event_id)),
                "error": str(exc),
                "failed_at": utc_now(),
            }
            error_count += 1

        _upsert_manifest_entry(manifest, event)
        save_json(MANIFEST_PATH, manifest)
        save_json(ERRORS_PATH, [errors_by_id[key] for key in sorted(errors_by_id)])
        save_json(
            PROGRESS_PATH,
            {
                "last_event_id": event_id,
                "updated_at": utc_now(),
            },
        )
        time.sleep(delay_seconds)

    save_json(MANIFEST_PATH, manifest)
    save_json(ERRORS_PATH, [errors_by_id[key] for key in sorted(errors_by_id)])
    return ok_count, skip_count, error_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Exportera Resultatbanken-data.")
    parser.add_argument("--metadata-only", action="store_true", help="Hämta bara manifest.json")
    parser.add_argument("--content-only", action="store_true", help="Ladda bara ner innehåll från befintlig manifest")
    parser.add_argument("--resume", action="store_true", help="Hoppa över redan nedladdade filer")
    parser.add_argument("--id", dest="event_ids", type=int, nargs="+", help="Ladda bara specifika ID:n")
    parser.add_argument("--delay", type=float, default=1.0, help="Paus i sekunder mellan requests")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_dirs()
    session = create_session()

    if args.content_only:
        manifest = load_json(MANIFEST_PATH, [])
        if not manifest and not args.event_ids:
            print(f"Ingen manifest hittades i {MANIFEST_PATH}", file=sys.stderr)
            return 1
    else:
        manifest = fetch_metadata(session)
        if args.metadata_only:
            return 0

    ok_count, skip_count, error_count = fetch_content(
        session,
        manifest,
        resume=args.resume,
        event_ids=args.event_ids,
        delay_seconds=args.delay,
    )

    print("")
    print("Export klar.")
    print(f"  Nedladdade: {ok_count}")
    print(f"  Hoppade över: {skip_count}")
    print(f"  Fel: {error_count}")
    print(f"  Manifest: {MANIFEST_PATH}")
    print(f"  Fel-logg: {ERRORS_PATH}")
    return 0 if error_count == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
