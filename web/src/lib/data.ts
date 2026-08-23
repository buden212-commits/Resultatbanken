import fs from "fs";
import path from "path";

import type { Event, Person, ResultRow } from "./types";
import { getMergedPerson, searchMergedPeople } from "./person-data";
import { resolveDisplayName, resolvePersonKey } from "./person-aliases";
import { parseTimeToSeconds } from "./time";

export { parseTimeToSeconds };

const DATA_DIR = path.join(process.cwd(), "..", "data");
const CONTENT_DIR = path.join(DATA_DIR, "content");

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), "utf-8")) as T;
}

export function getEvents(): Event[] {
  return readJson<Event[]>("manifest.json").sort((a, b) => b.date.localeCompare(a.date));
}

export function getEvent(id: number): Event | undefined {
  return getEvents().find((event) => event.id === id);
}

export function getResultsIndex(): ResultRow[] {
  return readJson<ResultRow[]>("results-index.json");
}

export function getPeopleIndex(): Person[] {
  return readJson<Person[]>("people-index.json");
}

export function getPerson(key: string): Person | undefined {
  return getMergedPerson(key);
}

export function searchPeople(query: string): Person[] {
  return searchMergedPeople(query);
}

export type ResolvedResultRow = ResultRow & {
  resolved_person_key: string;
  resolved_name: string;
};

export function getResultsForEvent(eventId: number): ResultRow[] {
  return getResultsIndex().filter((row) => row.event_id === eventId);
}

export function getResolvedResultsForEvent(eventId: number): ResolvedResultRow[] {
  return getResultsForEvent(eventId).map((row) => ({
    ...row,
    resolved_person_key: resolvePersonKey(row.person_key),
    resolved_name: resolveDisplayName(row.person_key, row.name),
  }));
}

export function findContentFile(id: number): { path: string; ext: string } | null {
  if (!fs.existsSync(CONTENT_DIR)) {
    return null;
  }

  const matches = fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.startsWith(`${id}.`))
    .sort();

  if (matches.length === 0) {
    return null;
  }

  const filename = matches[0];
  return {
    path: path.join(CONTENT_DIR, filename),
    ext: path.extname(filename).toLowerCase(),
  };
}

export function formatDate(date: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Date(`${date}T12:00:00`).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Last 365 days ending on the most recent event date in the dataset. */
export function getLastYearDateRange(): { from: string; to: string } {
  const events = getEvents();
  const to = events[0]?.date ?? new Date().toISOString().slice(0, 10);
  const fromDate = new Date(`${to}T12:00:00`);
  fromDate.setDate(fromDate.getDate() - 365);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export type LeaderStat = {
  displayName: string;
  value: number;
};

function isWithinLastYear(date: string | null, range: { from: string; to: string }): boolean {
  return !!date && date >= range.from && date <= range.to;
}

function getEventDateLookup(): Map<number, string> {
  return new Map(getEvents().map((event) => [event.id, event.date]));
}

export function getMostParticipationsInLastYear(): LeaderStat | null {
  const range = getLastYearDateRange();
  const eventDates = getEventDateLookup();
  let best: LeaderStat | null = null;

  for (const person of getPeopleIndex()) {
    const eventIds = new Set<number>();
    for (const result of person.results) {
      const date = result.date ?? eventDates.get(result.event_id) ?? null;
      if (!isWithinLastYear(date, range)) {
        continue;
      }
      eventIds.add(result.event_id);
    }

    const count = eventIds.size;
    if (count === 0) {
      continue;
    }
    if (!best || count > best.value) {
      best = { displayName: person.display_name, value: count };
    }
  }

  return best;
}

export function getLongestTotalTimeInLastYear(): LeaderStat | null {
  const range = getLastYearDateRange();
  const eventDates = getEventDateLookup();
  let best: LeaderStat | null = null;

  for (const person of getPeopleIndex()) {
    let totalSeconds = 0;
    for (const result of person.results) {
      const date = result.date ?? eventDates.get(result.event_id) ?? null;
      if (!isWithinLastYear(date, range) || !result.time) {
        continue;
      }
      const seconds = parseTimeToSeconds(result.time);
      if (seconds !== null) {
        totalSeconds += seconds;
      }
    }

    if (totalSeconds === 0) {
      continue;
    }
    if (!best || totalSeconds > best.value) {
      best = { displayName: person.display_name, value: totalSeconds };
    }
  }

  return best;
}
