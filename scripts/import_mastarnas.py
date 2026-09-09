"""Import Mästarnas Mästare standings PDFs into data/mastarnas.json."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data" / "mastarnas-source"
PEOPLE_PATH = ROOT / "data" / "people-index.json"
OUT_PATH = ROOT / "data" / "mastarnas.json"

CLASS_SHEET = re.compile(r":\s*[DH]\d", re.I)
YOUTH_CLASS = re.compile(r"^[DH](10|12|14|16)$", re.I)
PLACE_NUMBER = re.compile(r"^\d+$")

DISCIPLINE_ALIASES = {
    "skidor": ("skidor", "skid"),
    "skid-o": ("skid-o", "skido", "skid o"),
    "indoor": ("indoor", "inomhus"),
    "medel": ("medel",),
    "lang": ("lang", "lång", "langdistans", "långdistans"),
    "sprint": ("sprint",),
    "mtb-o": ("mtb-o", "mtbo", "mtb o"),
    "terrang": ("terrang", "terräng", "terr"),
    "natt": ("natt",),
    "kort": ("kort",),
    "dag": ("dag",),
}

DISCIPLINE_NAMES = {
    "skidor": "Skidor",
    "skid-o": "Skid-o",
    "indoor": "Indoor",
    "medel": "Medel",
    "lang": "Lång",
    "sprint": "Sprint",
    "mtb-o": "Mtb-o",
    "terrang": "Terräng",
    "natt": "Natt",
    "kort": "Kort",
    "dag": "Dag",
}

DISCIPLINE_ORDER = [
    "skidor",
    "skid-o",
    "indoor",
    "medel",
    "lang",
    "sprint",
    "mtb-o",
    "terrang",
    "natt",
    "kort",
    "dag",
]

SKIP_HEADER = {
    "plac",
    "pl",
    "fornamn",
    "förnamn",
    "efternamn",
    "namn",
    "klass",
    "summa",
    "antal",
    "starter",
    "tavlingar",
    "tävlingar",
    "snitt",
    "genomsnitt",
    "genom-snitt",
    "genom",
}


def fold(value: str) -> str:
    text = unicodedata.normalize("NFD", value.strip().lower())
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", fold(value))
    return cleaned.strip("-")


def cell_text(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\n", " ")).strip()


def parse_number(value: str) -> float | None:
    text = value.strip().lower().replace(" ", "")
    if not text or text in {"-", "–", "—"}:
        return None
    if "utgatt" in fold(text) or text in {"dnf", "dns", "ej"}:
        return None
    text = text.replace(",", ".")
    try:
        number = float(text)
    except ValueError:
        return None
    if number < 0 or number > 200:
        return None
    return round(number, 2) if number != int(number) else float(int(number))


def normalize_header_cell(value: str) -> str:
    text = cell_text(value)
    text = re.sub(r"\d{1,2}/\d{1,2}", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def classify_header(value: str) -> str | None:
    folded = fold(normalize_header_cell(value))
    if not folded:
        return None
    if folded in SKIP_HEADER or folded.startswith("summa") or folded.startswith("antal") or folded.startswith("genom"):
        return "meta"
    best_id = None
    best_len = -1
    for disc_id, aliases in DISCIPLINE_ALIASES.items():
        for alias in aliases:
            if folded == alias or folded.endswith(" " + alias) or folded.startswith(alias + " "):
                if len(alias) > best_len:
                    best_id = disc_id
                    best_len = len(alias)
    return best_id


def load_people_lookup() -> dict[str, tuple[str, str]]:
    if not PEOPLE_PATH.exists():
        return {}
    people = json.loads(PEOPLE_PATH.read_text(encoding="utf-8"))
    lookup: dict[str, tuple[str, str]] = {}
    for person in people:
        key = person["person_key"]
        name = person["display_name"]
        lookup[slug(name)] = (key, name)
        parts = name.split()
        if len(parts) >= 2:
            lookup[slug(f"{parts[-1]} {' '.join(parts[:-1])}")] = (key, name)
    return lookup


def resolve_person(first: str, last: str, lookup: dict[str, tuple[str, str]]) -> tuple[str, str]:
    first = first.strip()
    last = last.strip()
    forward = re.sub(r"\s+", " ", f"{first} {last}".strip())
    swapped = re.sub(r"\s+", " ", f"{last} {first}".strip())
    if not forward:
        return "", ""
    for candidate in (forward, swapped):
        match = lookup.get(slug(candidate))
        if match:
            return match
    return slug(forward), forward


def extract_tables(page) -> list[list[list]]:
    tables = page.extract_tables() or []
    if tables:
        return tables
    table = page.extract_table(
        {
            "vertical_strategy": "text",
            "horizontal_strategy": "text",
        }
    )
    return [table] if table else []


def is_class_sheet(first_cell: str) -> bool:
    return bool(CLASS_SHEET.search(first_cell or ""))


def find_header(rows: list[list]) -> tuple[int, list[str]] | None:
    for index, row in enumerate(rows[:6]):
        labels = [normalize_header_cell(cell) for cell in row]
        disc_hits = sum(1 for label in labels if classify_header(label) not in {None, "meta"} and classify_header(label))
        has_name = any(fold(label) in {"fornamn", "förnamn", "efternamn", "namn"} for label in labels)
        if disc_hits >= 2 or (has_name and disc_hits >= 1):
            return index, labels
        # Merged first cell: "Plac Förnamn Efternamn Klass"
        joined = fold(" ".join(labels))
        if "skidor" in joined and ("fornamn" in joined or "plac" in joined):
            return index, labels
    return None


def column_map(headers: list[str], sample_row: list[str] | None = None) -> dict[str, int]:
    mapping: dict[str, int] = {}
    used = set()
    for index, header in enumerate(headers):
        folded = fold(normalize_header_cell(header))
        if not folded:
            continue
        if folded in {"plac", "pl"}:
            mapping["place"] = index
            used.add(index)
        elif folded in {"fornamn", "förnamn"}:
            mapping["first"] = index
            used.add(index)
        elif folded in {"efternamn"}:
            mapping["last"] = index
            used.add(index)
        elif folded in {"namn"}:
            mapping["name"] = index
            used.add(index)
        elif folded in {"klass"}:
            mapping["class"] = index
            used.add(index)
        else:
            kind = classify_header(header)
            if kind and kind != "meta":
                mapping[kind] = index
                used.add(index)

    # 2003/2008 sometimes merge identity columns into one header cell.
    if "first" not in mapping or "last" not in mapping:
        if sample_row and len(sample_row) >= 4 and PLACE_NUMBER.match(cell_text(sample_row[0]) or ""):
            mapping.setdefault("place", 0)
            mapping.setdefault("first", 1)
            mapping.setdefault("last", 2)
            # class present if 4th cell looks like D10/H21
            fourth = cell_text(sample_row[3] if len(sample_row) > 3 else "")
            if re.fullmatch(r"[DH]\d{2}(?:-\d+)?", fourth, re.I):
                mapping.setdefault("class", 3)
    return mapping


def parse_row(row: list, mapping: dict[str, int], lookup: dict[str, tuple[str, str]], year: int) -> dict | None:
    def at(key: str) -> str:
        index = mapping.get(key)
        if index is None or index >= len(row):
            return ""
        return cell_text(row[index])

    first = at("first")
    last = at("last")
    name = at("name")
    first = re.sub(r"^[\-\u2013\s]+", "", first)
    last = re.sub(r"^[\-\u2013\s]+", "", last)
    name = re.sub(r"^[\-\u2013\s]+", "", name)
    if year == 2003 and first and last:
        first, last = last, first
    if name and not (first or last):
        parts = name.split()
        if len(parts) >= 2:
            first, last = " ".join(parts[:-1]), parts[-1]
        else:
            first = name

    # 2003 stores Lastname Firstname in first/last columns.
    place_raw = at("place")
    class_name = at("class")

    if not PLACE_NUMBER.match(place_raw) and not first and not last:
        return None

    person_key, display = resolve_person(first, last, lookup)
    if not display:
        return None

    class_name = class_name.upper() if class_name else ""
    if class_name and not re.match(r"^[DH]\d", class_name):
        class_name = ""

    scores: dict[str, float] = {}
    for disc_id in DISCIPLINE_ORDER:
        if disc_id not in mapping:
            continue
        value = parse_number(at(disc_id))
        if value is not None and value > 0:
            scores[disc_id] = value

    if not scores:
        return None

    return {
        "person_key": person_key,
        "name": display,
        "class_name": class_name,
        "scores": scores,
    }


def parse_year(path: Path, year: int, lookup: dict[str, tuple[str, str]]) -> list[dict]:
    people: list[dict] = []
    header_map: dict[str, int] | None = None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            tables = extract_tables(page)
            if not tables:
                continue
            rows = tables[0]
            if not rows:
                continue
            first_cell = cell_text(rows[0][0] if rows[0] else "")
            if is_class_sheet(first_cell):
                break

            header = find_header(rows)
            data_rows = rows
            if header:
                header_index, headers = header
                sample = rows[header_index + 1] if header_index + 1 < len(rows) else None
                header_map = column_map(headers, sample)
                data_rows = rows[header_index + 1 :]
            elif header_map is None:
                continue

            for row in data_rows:
                parsed = parse_row(row, header_map, lookup, year)
                if parsed:
                    people.append(parsed)
    return people


def class_id_for(name: str) -> str:
    if not name:
        return "okand"
    return slug(name)


def build_dataset(by_year: dict[int, list[dict]]) -> dict:
    classes: dict[str, dict] = {}
    disciplines: dict[str, dict] = {}
    seasons = []

    for year, people in sorted(by_year.items(), reverse=True):
        used_disc: dict[str, list] = {}
        for person in people:
            class_name = person["class_name"]
            cid = class_id_for(class_name)
            if cid not in classes:
                classes[cid] = {
                    "id": cid,
                    "name": class_name or "–",
                    "is_youth": bool(YOUTH_CLASS.match(class_name)),
                }
            for disc_id, points in person["scores"].items():
                used_disc.setdefault(disc_id, []).append(
                    {
                        "id": f"{year}-{disc_id}-{person['person_key']}-{cid}",
                        "person_key": person["person_key"],
                        "name": person["name"],
                        "class_id": cid,
                        "place": None,
                        "status": "ok",
                        "points": points,
                    }
                )
                if disc_id not in disciplines:
                    disciplines[disc_id] = {
                        "id": disc_id,
                        "name": DISCIPLINE_NAMES[disc_id],
                        "sort_order": DISCIPLINE_ORDER.index(disc_id) + 1,
                        "is_medel": disc_id == "medel",
                    }

        events = []
        for disc_id in DISCIPLINE_ORDER:
            if disc_id not in used_disc:
                continue
            events.append(
                {
                    "id": f"{year}-{disc_id}",
                    "discipline_id": disc_id,
                    "name": DISCIPLINE_NAMES[disc_id],
                    "date": "",
                    "results": used_disc[disc_id],
                }
            )
        seasons.append({"year": year, "events": events})

    # Keep default adult/youth classes even if unused yet.
    extra_defaults = [
        ("d17-34", "D17-34", False),
        ("d35", "D35", False),
        ("h17-34", "H17-34", False),
        ("h35", "H35", False),
        ("d75", "D75", False),
        ("h75", "H75", False),
    ]
    for cid, name, youth in extra_defaults:
        classes.setdefault(cid, {"id": cid, "name": name, "is_youth": youth})

    class_list = sorted(classes.values(), key=lambda item: (item["name"] == "–", item["name"]))
    disc_list = sorted(disciplines.values(), key=lambda item: item["sort_order"])
    return {"classes": class_list, "disciplines": disc_list, "seasons": seasons}


def main() -> None:
    lookup = load_people_lookup()
    by_year: dict[int, list[dict]] = {}
    for path in sorted(SOURCE_DIR.glob("*.bin")):
        year = int(path.stem)
        people = parse_year(path, year, lookup)
        by_year[year] = people
        matched = sum(1 for person in people if person["person_key"] in {key for key, _ in lookup.values()} or person["person_key"] in lookup)
        # recount properly
        matched = 0
        for person in people:
            if lookup.get(slug(person["name"])) or any(key == person["person_key"] for key, _ in lookup.values()):
                matched += 1
        classes = sorted({person["class_name"] or "–" for person in people})
        discs = sorted({disc for person in people for disc in person["scores"]})
        print(f"{year}: {len(people)} personer, {matched} kopplade till arkivet, klasser={classes}, grenar={discs}")

    data = build_dataset(by_year)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nSkrev {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
