import { isKmEvent, searchEvents } from "./event-search";
import { assignClassPoints } from "./mastarnas-points";
import { toSlug } from "./slug";
import { isUnreasonableTime, parseTimeToSeconds } from "./time";
import type { Event } from "./types";
import type { ResolvedResultRow } from "./data";
import type { MastarnasClass, MastarnasDiscipline, MastarnasStatus } from "./mastarnas-types";

export type ArchiveEventHit = {
  id: number;
  name: string;
  type: string;
  date: string;
  location: string;
};

export type SourceClassSummary = {
  source: string;
  cleaned: string;
  count: number;
  suggested_class_id: string;
  hint: string;
};

export type ImportPreviewRow = {
  name: string;
  person_key: string;
  place: number | null;
  status: MastarnasStatus;
  time: string | null;
  source_class: string;
  points: number;
};

export type ImportPreviewGroup = {
  class_id: string;
  class_name: string;
  rows: ImportPreviewRow[];
};

const SKIP_CLASS = /insk|oppen|öppen|motion|open|nyborj|nybörj|direkt|shadow/i;

const CLASS_ALIASES: Record<string, string> = {
  d21: "d17-34",
  h21: "h17-34",
  d20: "d17-34",
  h20: "h17-34",
  d19: "d17-34",
  h19: "h17-34",
};

const MERGE_HINTS: Record<string, string> = {
  ...CLASS_ALIASES,
  d18: "d17-34",
  h18: "h17-34",
};

export function cleanArchiveClassName(raw: string | null | undefined): string {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text || text === "–" || text === "-") {
    return "";
  }
  const meos = text.match(/^([DH]\d{1,2}(?:-\d+)?)\b/i);
  if (meos) {
    const token = meos[1];
    return `${token[0]!.toUpperCase()}${token.slice(1)}`;
  }
  return text.split("(")[0]!.trim();
}

export function cleanArchiveTime(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) {
    return null;
  }
  const match = text.match(/\d+:\d{2}(?::\d{2})?/);
  return match?.[0] ?? text;
}

export function suggestMmClassId(
  cleaned: string,
  classes: MastarnasClass[],
  savedMap: Record<string, string> = {},
): string {
  if (!cleaned) {
    return "";
  }
  const saved = savedMap[cleaned];
  if (saved && (saved === "" || classes.some((item) => item.id === saved))) {
    return saved;
  }
  if (SKIP_CLASS.test(cleaned)) {
    return "";
  }
  const id = toSlug(cleaned);
  if (classes.some((item) => item.id === id)) {
    return id;
  }
  if (id === "d18" || id === "h18") {
    return classes.some((item) => item.id === id) ? id : id.startsWith("d") ? "d17-34" : "h17-34";
  }
  const alias = CLASS_ALIASES[id];
  if (alias && classes.some((item) => item.id === alias)) {
    return alias;
  }
  return "";
}

function mappingHint(cleaned: string, suggested: string, classes: MastarnasClass[]): string {
  const id = toSlug(cleaned);
  const mergeTo = MERGE_HINTS[id];
  if (!mergeTo || mergeTo === suggested) {
    return "";
  }
  const target = classes.find((item) => item.id === mergeTo);
  if (!target || !classes.some((item) => item.id === id)) {
    return "";
  }
  return `Kan slås ihop med ${target.name}`;
}

export function suggestDisciplineId(event: Pick<Event, "name" | "type">, disciplines: MastarnasDiscipline[]): string {
  const hay = `${event.name} ${event.type}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/skid-?o|skido/, "skid-o"],
    [/indoor|inomhus/, "indoor"],
    [/mtb/, "mtb-o"],
    [/natt/, "natt"],
    [/sprint/, "sprint"],
    [/lång|langdistans|långdistans/, "lang"],
    [/medel/, "medel"],
    [/terräng|terrang/, "terrang"],
    [/skid/, "skidor"],
  ];
  for (const [pattern, id] of rules) {
    if (pattern.test(hay) && disciplines.some((item) => item.id === id)) {
      return id;
    }
  }
  return disciplines[0]?.id ?? "";
}

export function searchArchiveEvents(events: Event[], query: string): ArchiveEventHit[] {
  const trimmed = query.trim();
  const filtered = trimmed ? searchEvents(events, trimmed) : events.filter(isKmEvent);
  return filtered.slice(0, 50).map((event) => ({
    id: event.id,
    name: event.name,
    type: event.type,
    date: event.date,
    location: event.location,
  }));
}

export function summarizeSourceClasses(
  rows: ResolvedResultRow[],
  classes: MastarnasClass[],
  savedMap: Record<string, string>,
): SourceClassSummary[] {
  const counts = new Map<string, { source: string; cleaned: string; count: number }>();
  for (const row of rows) {
    const source = row.class_name?.trim() || "–";
    const cleaned = cleanArchiveClassName(source);
    const key = cleaned || source;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { source, cleaned, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => (a.cleaned || a.source).localeCompare(b.cleaned || b.source, "sv"))
    .map((item) => {
      const suggested_class_id = suggestMmClassId(item.cleaned, classes, savedMap);
      return {
        ...item,
        suggested_class_id,
        hint: mappingHint(item.cleaned, suggested_class_id, classes),
      };
    });
}

function archiveStatus(row: ResolvedResultRow): MastarnasStatus | "skip" {
  const status = (row.status || "").toLowerCase();
  if (status === "dns") {
    return "skip";
  }
  if (status === "dnf" || status === "felst" || status.includes("utg")) {
    return "dnf";
  }
  if (row.place !== null && row.place >= 1) {
    return "ok";
  }
  if (row.time && parseTimeToSeconds(row.time) !== null) {
    return "ok";
  }
  if (status === "deltagit") {
    return "dnf";
  }
  return "skip";
}

function timeSortValue(time: string | null, preferReasonable: boolean): number {
  const seconds = parseTimeToSeconds(time ?? "");
  if (seconds === null) {
    return Number.POSITIVE_INFINITY;
  }
  if (preferReasonable && isUnreasonableTime(time)) {
    return Number.POSITIVE_INFINITY / 2 + seconds;
  }
  return seconds;
}

function rankFinishers<T extends { time: string | null; place: number | null }>(
  rows: T[],
  mergedClasses: boolean,
): (T & { place: number })[] {
  const sorted = [...rows].sort((a, b) => {
    if (!mergedClasses) {
      const placeA = a.place ?? 9999;
      const placeB = b.place ?? 9999;
      if (placeA !== placeB) {
        return placeA - placeB;
      }
    }
    const left = timeSortValue(a.time, mergedClasses);
    const right = timeSortValue(b.time, mergedClasses);
    if (left !== right) {
      return left - right;
    }
    return (a.place ?? 9999) - (b.place ?? 9999);
  });
  const ranked: (T & { place: number })[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const row = sorted[index]!;
    const time = parseTimeToSeconds(row.time ?? "");
    const previous = ranked[index - 1];
    const previousTime = previous ? parseTimeToSeconds(previous.time ?? "") : null;
    const tied = Boolean(previous && time !== null && time === previousTime);
    ranked.push({ ...row, place: tied ? previous!.place : index + 1 });
  }
  return ranked;
}

export function buildImportPreview(
  rows: ResolvedResultRow[],
  mapping: Record<string, string>,
  classes: MastarnasClass[],
): { groups: ImportPreviewGroup[]; skipped: number; unmapped: number } {
  type Acc = {
    name: string;
    person_key: string;
    status: MastarnasStatus;
    time: string | null;
    place: number | null;
    source_class: string;
  };
  const byClass = new Map<string, Map<string, Acc>>();
  let skipped = 0;
  let unmapped = 0;

  for (const row of rows) {
    const source = row.class_name?.trim() || "–";
    const cleaned = cleanArchiveClassName(source);
    const key = cleaned || source;
    const classId = mapping[key] ?? mapping[cleaned] ?? "";
    if (!classId) {
      unmapped += 1;
      continue;
    }
    const status = archiveStatus(row);
    if (status === "skip") {
      skipped += 1;
      continue;
    }
    const people = byClass.get(classId) ?? new Map<string, Acc>();
    const personKey = row.resolved_person_key || row.person_key;
    const next: Acc = {
      name: row.resolved_name || row.name,
      person_key: personKey,
      status,
      time: cleanArchiveTime(row.time),
      place: row.place,
      source_class: cleaned || source,
    };
    const existing = people.get(personKey);
    if (!existing) {
      people.set(personKey, next);
    } else {
      const existingTime = parseTimeToSeconds(existing.time ?? "") ?? Number.POSITIVE_INFINITY;
      const nextTime = parseTimeToSeconds(next.time ?? "") ?? Number.POSITIVE_INFINITY;
      if (next.status === "ok" && (existing.status !== "ok" || nextTime < existingTime)) {
        people.set(personKey, next);
      }
    }
    byClass.set(classId, people);
  }

  const className = new Map(classes.map((item) => [item.id, item.name]));
  const groups: ImportPreviewGroup[] = [];
  for (const [classId, people] of [...byClass.entries()].sort((a, b) =>
    (className.get(a[0]) ?? a[0]).localeCompare(className.get(b[0]) ?? b[0], "sv"),
  )) {
    const list = [...people.values()];
    const okRows = list.filter((row) => row.status === "ok");
    const mergedClasses = new Set(okRows.map((row) => row.source_class)).size > 1;
    const finishers = rankFinishers(okRows, mergedClasses);
    const placeByKey = new Map(finishers.map((row) => [row.person_key, row.place]));
    const ranked = list.map((row, index) => ({
      id: row.person_key,
      place: row.status === "ok" ? (placeByKey.get(row.person_key) ?? null) : null,
      status: row.status,
      name: row.name,
      person_key: row.person_key,
      time: row.time,
      source_class: row.source_class,
      order: index,
    }));
    const scored = assignClassPoints(ranked);
    groups.push({
      class_id: classId,
      class_name: className.get(classId) ?? classId,
      rows: scored
        .sort((a, b) => (a.place ?? 999) - (b.place ?? 999) || a.name.localeCompare(b.name, "sv"))
        .map((row) => ({
          name: row.name,
          person_key: row.person_key,
          place: row.place,
          status: row.status,
          time: row.time,
          source_class: row.source_class,
          points: row.points,
        })),
    });
  }

  return { groups, skipped, unmapped };
}
