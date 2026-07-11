#!/usr/bin/env python3
"""Extract participant names from all downloaded result files."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CONTENT = DATA / "content"
MANIFEST_PATH = DATA / "manifest.json"
RESULTS_INDEX_PATH = DATA / "results-index.json"
PARSE_ERRORS_PATH = DATA / "parse-errors.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))

from content_type import resolve_parser_suffix  # noqa: E402
from parsers import PARSERS  # noqa: E402


def find_content_file(event_id: int) -> Path | None:
    matches = sorted(CONTENT.glob(f"{event_id}.*"))
    return matches[0] if matches else None


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def extract_event(event: dict) -> tuple[list[dict], list[dict] | None]:
    event_id = event["id"]
    path = find_content_file(event_id)
    if path is None:
        return [], {"event_id": event_id, "error": "missing file"}

    suffix = resolve_parser_suffix(path, event)
    parser = PARSERS.get(suffix)
    if parser is None:
        return [], {
            "event_id": event_id,
            "error": f"unsupported extension {path.suffix} (detected {suffix})",
        }

    try:
        rows = parser(path, event_id)
    except Exception as exc:  # noqa: BLE001
        return [], {"event_id": event_id, "error": str(exc), "file": path.name}

    if not rows:
        return [], {"event_id": event_id, "error": "no participants parsed", "file": path.name}

    return [row.to_dict() for row in rows], None


def extract_all() -> tuple[list[dict], list[dict]]:
    manifest = load_manifest()
    results: list[dict] = []
    errors: list[dict] = []

    for event in manifest:
        rows, error = extract_event(event)
        if error:
            errors.append(error)
            continue
        results.extend(rows)

    return results, errors


def extract_single(event_id: int) -> tuple[list[dict], list[dict]]:
    manifest = {event["id"]: event for event in load_manifest()}
    event = manifest.get(event_id)
    if event is None:
        return [], [{"event_id": event_id, "error": "event not found in manifest"}]

    rows, error = extract_event(event)
    errors = [error] if error else []
    return rows, errors


def load_json_list(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def write_outputs(results: list[dict], errors: list[dict]) -> None:
    RESULTS_INDEX_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    PARSE_ERRORS_PATH.write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Extract participant names from result files.")
    parser.add_argument("--event-id", type=int, help="Only parse one event and merge into existing indexes.")
    args = parser.parse_args()

    if args.event_id is not None:
        new_results, new_errors = extract_single(args.event_id)
        existing_results = load_json_list(RESULTS_INDEX_PATH)
        existing_errors = load_json_list(PARSE_ERRORS_PATH)

        results = [row for row in existing_results if row["event_id"] != args.event_id]
        results.extend(new_results)
        errors = [row for row in existing_errors if row["event_id"] != args.event_id]
        errors.extend(new_errors)

        write_outputs(results, errors)
        parsed_events = 1 if new_results else 0
        print(f"Event {args.event_id}: extraherade {len(new_results)} starter.")
        print(f"Parse-fel/empty: {len(new_errors)}")
        print(f"Uppdaterade {RESULTS_INDEX_PATH}")
        return 0

    results, errors = extract_all()
    write_outputs(results, errors)

    parsed_events = len({row["event_id"] for row in results})
    print(f"Extraherade {len(results)} starter från {parsed_events} events.")
    print(f"Parse-fel/empty: {len(errors)}")
    print(f"Skrev {RESULTS_INDEX_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
