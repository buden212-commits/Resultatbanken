#!/usr/bin/env python3
"""Minimal Eventor API-klient för IFK Mora OK / Resultatbanken.

Autentisering: HTTP-header ApiKey (klubbnyckel från Eventor → Klubb → Inställningar).

Exempel:
  set EVENTOR_API_KEY=...
  python scripts/eventor.py whoami
  python scripts/eventor.py events --from 2025-01-01 --to 2025-12-31
  python scripts/eventor.py results 52254 --club
"""

from __future__ import annotations

import argparse
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE_URL = "https://eventor.orientering.se/api"
ROOT = Path(__file__).resolve().parents[1]


def _load_dotenv() -> None:
    """Läs EVENTOR_API_KEY från .env / web/.env.local om den inte redan finns i miljön."""
    if os.environ.get("EVENTOR_API_KEY", "").strip():
        return
    for path in (
        ROOT / ".env",
        ROOT / ".env.local",
        ROOT / "web" / ".env.local",
    ):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            if key.strip() == "EVENTOR_API_KEY":
                os.environ["EVENTOR_API_KEY"] = value.strip().strip('"').strip("'")
                return


def get_api_key() -> str:
    _load_dotenv()
    key = os.environ.get("EVENTOR_API_KEY", "").strip()
    if not key:
        print(
            "Saknar EVENTOR_API_KEY.\n"
            "Lägg den i .env i repo-roten (gitignorerad):\n"
            "  EVENTOR_API_KEY=din-32-teckens-nyckel\n"
            "eller sätt miljövariabeln i terminalen.",
            file=sys.stderr,
        )
        sys.exit(1)
    return key


def eventor_get(path: str, params: dict[str, Any] | None = None) -> str:
    """GET mot Eventor API. Returnerar rå XML-sträng."""
    key = get_api_key()
    query = urlencode({k: v for k, v in (params or {}).items() if v is not None and v != ""})
    url = f"{BASE_URL}/{path.lstrip('/')}"
    if query:
        url = f"{url}?{query}"
    req = Request(url, headers={"ApiKey": key, "Accept": "application/xml"})
    try:
        with urlopen(req, timeout=60) as resp:
            return resp.read().decode("utf-8")
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        raise SystemExit(f"HTTP {e.code} {e.reason} för {url}\n{body}") from e
    except URLError as e:
        raise SystemExit(f"Nätverksfel: {e.reason}") from e


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _text(el: ET.Element | None, *names: str) -> str:
    if el is None:
        return ""
    if not names:
        return (el.text or "").strip()
    for child in el:
        if _local(child.tag) == names[0]:
            return _text(child, *names[1:])
    return ""


def _find_all(root: ET.Element, name: str) -> list[ET.Element]:
    return [el for el in root.iter() if _local(el.tag) == name]


def cmd_whoami(_: argparse.Namespace) -> None:
    xml = eventor_get("organisation/apiKey")
    root = ET.fromstring(xml)
    org_id = root.attrib.get("organisationId") or _text(root, "OrganisationId")
    name = _text(root, "Name") or root.attrib.get("name", "")
    media = _text(root, "MediaName")
    print("API-nyckeln fungerar.")
    print(f"  Organisation: {name or '(okänt namn)'}")
    if media:
        print(f"  MediaName:    {media}")
    print(f"  Id:           {org_id or '(saknas)'}")
    # Spara organisations-id för senare klubbanrop
    if org_id:
        print(f"\nTips: använd organisationIds={org_id} för klubbresultat.")


def cmd_events(args: argparse.Namespace) -> None:
    params: dict[str, Any] = {
        "fromDate": f"{args.from_date} 00:00:00",
        "toDate": f"{args.to_date} 23:59:59",
    }
    if args.organisation:
        params["organisationIds"] = args.organisation
    if args.classification:
        params["classificationIds"] = args.classification
    xml = eventor_get("events", params)
    root = ET.fromstring(xml)
    events = _find_all(root, "Event")
    print(f"{len(events)} tävlingar ({args.from_date} – {args.to_date})\n")
    for ev in events[: args.limit]:
        eid = ev.attrib.get("eventId") or _text(ev, "EventId")
        name = _text(ev, "Name")
        start = _text(ev, "StartDate", "Date") or _text(ev, "StartDate")
        print(f"  {eid:>6}  {start or '?':10}  {name}")
    if len(events) > args.limit:
        print(f"  … och {len(events) - args.limit} till (öka med --limit)")


def cmd_results(args: argparse.Namespace) -> None:
    if args.club:
        org_xml = eventor_get("organisation/apiKey")
        org = ET.fromstring(org_xml)
        org_id = org.attrib.get("organisationId") or _text(org, "OrganisationId")
        if not org_id:
            raise SystemExit("Kunde inte läsa organisationId från /organisation/apiKey")
        xml = eventor_get(
            "results/organisation",
            {
                "eventId": args.event_id,
                "organisationIds": org_id,
                "includeSplitTimes": "false",
            },
        )
        label = f"klubbresultat (org {org_id})"
    elif args.iof:
        xml = eventor_get(
            "results/event/iofxml",
            {
                "eventId": args.event_id,
                "includeSplitTimes": "false",
            },
        )
        label = "IOF XML 3.0"
    else:
        xml = eventor_get(
            "results/event",
            {
                "eventId": args.event_id,
                "includeSplitTimes": "false",
                "top": args.top,
            },
        )
        label = "hela tävlingen"

    if args.out:
        out = Path(args.out)
        out.write_text(xml, encoding="utf-8")
        print(f"Sparade {label} -> {out} ({len(xml)} tecken)")
        return

    root = ET.fromstring(xml)
    # Eventor ResultList / IOF ResultList — räkna personer
    persons = _find_all(root, "PersonResult") or _find_all(root, "Person")
    event_name = _text(root, "Event", "Name") or _text(root, "EventName")
    print(f"Event {args.event_id}: {event_name or '(namn saknas)'} — {label}")
    print(f"PersonResult/Person-element: {len(persons)}")
    # Visa några namn + tider om strukturen finns
    shown = 0
    for pr in _find_all(root, "PersonResult"):
        name = " ".join(
            p
            for p in (
                _text(pr, "Person", "PersonName", "Given"),
                _text(pr, "Person", "PersonName", "Family"),
            )
            if p
        )
        if not name:
            name = _text(pr, "Person", "Name") or "?"
        result = next((c for c in pr if _local(c.tag) == "Result"), None)
        time_s = _text(result, "Time") if result is not None else ""
        place = _text(result, "ResultPosition") if result is not None else ""
        status = ""
        if result is not None:
            for c in result:
                if _local(c.tag) == "CompetitorStatus":
                    status = c.attrib.get("value", "") or (c.text or "")
        print(f"  {place or '-':>4}  {time_s or status or '-':>10}  {name}")
        shown += 1
        if shown >= args.limit:
            break
    if shown == 0:
        # Fallback: skriv ut början av XML
        print(xml[:800])
        if len(xml) > 800:
            print("...")


CLASSIFICATION_TYPE = {
    "1": "Mästerskap",
    "2": "Nationell tävling",
    "3": "Distriktstävling",
    "4": "Närtävling",
    "5": "Klubbtävling",
    "6": "Internationell tävling",
}


def cmd_import(args: argparse.Namespace) -> None:
    """Hämta klubbresultat och skriv till data/ (manifest + content + index)."""
    import json
    import subprocess

    eventor_id = args.event_id.strip()
    if not eventor_id.isdigit():
        raise SystemExit("Ogiltigt Eventor-id")

    data_dir = ROOT / "data"
    manifest_path = data_dir / "manifest.json"
    content_dir = data_dir / "content"

    manifest: list[dict] = json.loads(manifest_path.read_text(encoding="utf-8"))
    needle = f"/Events/Show/{eventor_id}"
    for event in manifest:
        if needle in (event.get("source_url") or ""):
            raise SystemExit(
                f"Eventor-event {eventor_id} finns redan som id {event['id']} ({event['name']})"
            )

    org_xml = eventor_get("organisation/apiKey")
    org = ET.fromstring(org_xml)
    org_id = org.attrib.get("organisationId") or _text(org, "OrganisationId")
    if not org_id:
        raise SystemExit("Kunde inte läsa organisationId")

    xml = eventor_get(
        "results/organisation",
        {
            "eventId": eventor_id,
            "organisationIds": org_id,
            "includeSplitTimes": "false",
        },
    )
    root = ET.fromstring(xml)
    person_count = len(_find_all(root, "PersonResult"))
    if person_count == 0:
        raise SystemExit(f"Inga klubbresultat för Eventor-event {eventor_id}")

    event_el = next((c for c in root if _local(c.tag) == "Event"), None)
    name = (_text(event_el, "Name") if event_el is not None else "") or f"Eventor {eventor_id}"
    date = ""
    if event_el is not None:
        date = _text(event_el, "StartDate", "Date")
    classification = _text(event_el, "EventClassificationId") if event_el is not None else ""
    organizer = ""
    if event_el is not None:
        organizer = _text(event_el, "Organiser", "Organisation", "Name")

    next_id = max((int(e["id"]) for e in manifest), default=0) + 1
    stored_name = f"{next_id}.xml"
    content_dir.mkdir(parents=True, exist_ok=True)
    (content_dir / stored_name).write_text(xml, encoding="utf-8")

    source_url = f"https://eventor.orientering.se/Events/Show/{eventor_id}"
    free_text = args.free_text or ""
    note = f"Importerat från Eventor (klubbresultat). {source_url}"
    free_text = f"{free_text}\n{note}".strip() if free_text else note

    event = {
        "id": next_id,
        "name": name.strip(),
        "type": (args.type or CLASSIFICATION_TYPE.get(classification, "Tävling")),
        "date": date[:10] if date else "",
        "organizer": organizer,
        "location": "",
        "free_text": free_text,
        "result_file": f"eventor-{eventor_id}.xml",
        "file_size": len(xml.encode("utf-8")),
        "file_type": "application/xml",
        "source_url": source_url,
        "local_file": f"content/{stored_name}",
        "downloaded_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
    }
    manifest.append(event)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Sparade event {next_id}: {event['name']} ({person_count} PersonResult)")

    if not args.no_index:
        extract = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "extract_participants.py"), "--event-id", str(next_id)],
            cwd=ROOT,
            check=False,
        )
        rebuild = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "rebuild_index.py")],
            cwd=ROOT,
            check=False,
        )
        if extract.returncode != 0 or rebuild.returncode != 0:
            raise SystemExit("Indexering misslyckades — kör extract/rebuild manuellt.")
        print("Index uppdaterat.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Eventor API-klient")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_who = sub.add_parser("whoami", help="Verifiera ApiKey → organisation")
    p_who.set_defaults(func=cmd_whoami)

    p_ev = sub.add_parser("events", help="Lista tävlingar")
    p_ev.add_argument("--from", dest="from_date", default="2025-01-01")
    p_ev.add_argument("--to", dest="to_date", default="2025-12-31")
    p_ev.add_argument("--organisation", help="organisationIds (klubb/distrikt)")
    p_ev.add_argument("--classification", help="t.ex. 1,2,3")
    p_ev.add_argument("--limit", type=int, default=30)
    p_ev.set_defaults(func=cmd_events)

    p_res = sub.add_parser("results", help="Hämta resultat för ett event-id")
    p_res.add_argument("event_id", help="Eventor eventId")
    p_res.add_argument("--club", action="store_true", help="Endast egen klubb")
    p_res.add_argument("--iof", action="store_true", help="IOF XML 3.0")
    p_res.add_argument("--top", help="Begränsa till topp N (hela event)")
    p_res.add_argument("--out", help="Spara rå XML till fil")
    p_res.add_argument("--limit", type=int, default=25)
    p_res.set_defaults(func=cmd_results)

    p_imp = sub.add_parser("import", help="Importera klubbresultat till data/")
    p_imp.add_argument("event_id", help="Eventor eventId")
    p_imp.add_argument("--type", help="Överskriv eventtyp")
    p_imp.add_argument("--free-text", dest="free_text", default="", help="Fritext")
    p_imp.add_argument("--no-index", action="store_true", help="Hoppa över indexering")
    p_imp.set_defaults(func=cmd_import)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
