#!/usr/bin/env python3
"""Build people-index.json from results-index.json."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RESULTS_INDEX_PATH = DATA / "results-index.json"
PEOPLE_INDEX_PATH = DATA / "people-index.json"
MANIFEST_PATH = DATA / "manifest.json"


def main() -> int:
    results = json.loads(RESULTS_INDEX_PATH.read_text(encoding="utf-8"))
    manifest = {item["id"]: item for item in json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))}

    grouped: dict[str, dict] = defaultdict(
        lambda: {
            "display_name": "",
            "result_count": 0,
            "first_date": None,
            "last_date": None,
            "event_ids": set(),
            "results": [],
            "seen_results": set(),
        }
    )

    for row in results:
        key = row["person_key"]
        person = grouped[key]
        if not person["display_name"]:
            person["display_name"] = row["name"]

        dedupe_key = (
            row["event_id"],
            row.get("class_name"),
            row.get("place"),
            row.get("time"),
            row.get("status"),
        )
        if dedupe_key in person["seen_results"]:
            continue
        person["seen_results"].add(dedupe_key)

        person["result_count"] += 1
        person["event_ids"].add(row["event_id"])
        event = manifest.get(row["event_id"], {})
        date = event.get("date")
        if date:
            if person["first_date"] is None or date < person["first_date"]:
                person["first_date"] = date
            if person["last_date"] is None or date > person["last_date"]:
                person["last_date"] = date
        person["results"].append(
            {
                "event_id": row["event_id"],
                "event_name": event.get("name", ""),
                "date": date,
                "location": event.get("location", ""),
                "type": event.get("type", ""),
                "class_name": row.get("class_name"),
                "place": row.get("place"),
                "time": row.get("time"),
                "status": row.get("status"),
            }
        )

    people = []
    for key in sorted(grouped):
        person = grouped[key]
        person["person_key"] = key
        person["event_ids"] = sorted(person["event_ids"])
        person["results"].sort(key=lambda item: item.get("date") or "", reverse=True)
        person.pop("seen_results", None)
        people.append(person)

    people.sort(key=lambda item: item["display_name"].lower())
    PEOPLE_INDEX_PATH.write_text(json.dumps(people, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Skrev {len(people)} personer till {PEOPLE_INDEX_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
