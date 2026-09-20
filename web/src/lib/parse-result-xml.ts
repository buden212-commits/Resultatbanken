import { DOMParser, type Element as XmlEl } from "@xmldom/xmldom";

import { toSlug } from "./slug";
import type { ResultRow } from "./types";

const STATUS_MAP: Record<string, string | null> = {
  ok: null,
  inactive: "dns",
  didnotstart: "dns",
  didnotfinish: "dnf",
  mispunch: "felst",
  missingpunch: "felst",
  disqualified: "felst",
  overtime: "felst",
  cancelled: "dns",
  notcompeting: "deltagit",
};

function localName(tag: string): string {
  const idx = tag.lastIndexOf("}");
  return idx >= 0 ? tag.slice(idx + 1) : tag;
}

function children(el: XmlEl): XmlEl[] {
  const out: XmlEl[] = [];
  for (let i = 0; i < el.childNodes.length; i += 1) {
    const node = el.childNodes[i];
    if (node && node.nodeType === 1) {
      out.push(node as XmlEl);
    }
  }
  return out;
}

function child(el: XmlEl | null, ...names: string[]): XmlEl | null {
  let current: XmlEl | null = el;
  for (const name of names) {
    if (!current) {
      return null;
    }
    const found = children(current).find((node) => localName(node.tagName) === name) ?? null;
    current = found;
  }
  return current;
}

function text(el: XmlEl | null, ...names: string[]): string {
  const target = names.length ? child(el, ...names) : el;
  return (target?.textContent ?? "").trim();
}

function attrStatus(result: XmlEl): string {
  for (const node of children(result)) {
    const name = localName(node.tagName);
    if (name === "CompetitorStatus") {
      return (node.getAttribute("value") || node.textContent || "").trim();
    }
    if (name === "Status") {
      return (node.textContent || node.getAttribute("value") || "").trim();
    }
  }
  return "";
}

function mapStatus(raw: string): string | null {
  if (!raw) {
    return null;
  }
  const key = raw.replace(/\s+/g, "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(STATUS_MAP, key) ? STATUS_MAP[key] : raw.toLowerCase();
}

function formatSeconds(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (value.includes(":")) {
    return value;
  }
  const total = Number.parseInt(value, 10);
  if (!Number.isFinite(total) || total < 0) {
    return value;
  }
  const hours = Math.floor(total / 3600);
  const rem = total % 3600;
  const minutes = Math.floor(rem / 60);
  const seconds = rem % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function personName(person: XmlEl): string {
  const given =
    text(person, "PersonName", "Given") || text(person, "Name", "Given");
  const family =
    text(person, "PersonName", "Family") || text(person, "Name", "Family");
  if (given || family) {
    return `${given} ${family}`.trim();
  }
  return text(person, "Name") || text(person, "PersonName");
}

function className(classResult: XmlEl): string | null {
  const name =
    text(classResult, "EventClass", "Name") ||
    text(classResult, "EventClass", "ClassShortName") ||
    text(classResult, "Class", "Name") ||
    text(classResult, "Class", "ShortName");
  return name || null;
}

/**
 * Parse Eventor / IOF XML 3.0 ResultList into result rows (Node port of xml_parser.py).
 */
export function parseResultListXml(xml: string | Buffer, eventId: number): ResultRow[] {
  const source = typeof xml === "string" ? xml : xml.toString("utf-8");
  const doc = new DOMParser().parseFromString(source, "application/xml");
  const root = doc.documentElement;
  if (!root || localName(root.tagName) !== "ResultList") {
    return [];
  }

  const rows: ResultRow[] = [];
  for (const classResult of children(root)) {
    if (localName(classResult.tagName) !== "ClassResult") {
      continue;
    }
    const class_name = className(classResult);

    for (const personResult of children(classResult)) {
      if (localName(personResult.tagName) !== "PersonResult") {
        continue;
      }
      const person = child(personResult, "Person");
      if (!person) {
        continue;
      }
      const name = personName(person);
      if (!name) {
        continue;
      }
      const org = child(personResult, "Organisation");
      const club =
        text(org, "ShortName") || text(org, "Name") || text(org, "MediaName") || null;

      const result = child(personResult, "Result");
      if (!result) {
        continue;
      }

      let status = mapStatus(attrStatus(result));
      const timeRaw = text(result, "Time");
      const time = timeRaw ? formatSeconds(timeRaw) : null;
      if (status === null && !time) {
        status = "deltagit";
      }

      const placeRaw = text(result, "ResultPosition") || text(result, "Position");
      const place = /^\d+$/.test(placeRaw) ? Number(placeRaw) : null;

      rows.push({
        event_id: eventId,
        person_key: toSlug(name),
        name,
        club,
        class_name,
        place: status === null ? place : null,
        time: status === null ? time : null,
        status,
        parse_source: "xml_eventor",
        parse_confidence: "high",
      });
    }
  }

  return rows;
}
