import fs from "fs";
import path from "path";

import type { Event, Person, ResultRow } from "./types";
import { derivePlaces } from "./derive-places";
import { getMergedPerson, searchMergedPeople } from "./person-data";
import { getMastarnasOnlyPerson, searchMastarnasPeople } from "./mastarnas";
import { readCachedJson } from "./json-cache";
import { resolveDisplayName, resolvePersonKey } from "./person-aliases";
import { isUnreasonableTime, parseTimeToSeconds } from "./time";
import { findLocalContentFile } from "./db/content";
import {
  ensureDbSnapshot,
  getDbSnapshotSync,
  readContentUrlFromDb,
  requireDbSnapshot,
  useDbData,
} from "./db/store";

export { parseTimeToSeconds };
export { ensureDbSnapshot, useDbData };
export { ensureDataReady } from "./db/ready";

function resultRowScore(row: ResultRow): number {
  let score = 0;
  if (row.place !== null && row.place !== undefined) {
    score += 1_000;
    score -= row.place;
  }
  if (row.time) {
    score += 100;
  }
  if (row.class_name?.trim()) {
    score += 10;
  }
  if (row.status) {
    score += 5;
  }
  if (row.club) {
    score += 1;
  }
  return score;
}

function dedupeResultsByPerson(rows: ResultRow[]): ResultRow[] {
  const bestByPerson = new Map<string, ResultRow>();

  for (const row of rows) {
    const existing = bestByPerson.get(row.person_key);
    if (!existing || resultRowScore(row) > resultRowScore(existing)) {
      bestByPerson.set(row.person_key, row);
    }
  }

  return [...bestByPerson.values()];
}

const DATA_DIR = path.join(process.cwd(), "..", "data");
const CONTENT_DIR = path.join(DATA_DIR, "content");

function readJson<T>(filename: string): T {
  return readCachedJson<T>(path.join(DATA_DIR, filename));
}

export function getEvents(): Event[] {
  if (useDbData()) {
    return requireDbSnapshot().events;
  }
  return readJson<Event[]>("manifest.json").sort((a, b) => b.date.localeCompare(a.date));
}

export function getEvent(id: number): Event | undefined {
  return getEvents().find((event) => event.id === id);
}

export function getResultsIndex(): ResultRow[] {
  if (useDbData()) {
    return requireDbSnapshot().results;
  }
  return readJson<ResultRow[]>("results-index.json");
}

export function getPeopleIndex(): Person[] {
  if (useDbData()) {
    return requireDbSnapshot().people;
  }
  return readJson<Person[]>("people-index.json");
}

export function getPerson(key: string): Person | undefined {
  return getMergedPerson(key) ?? getMastarnasOnlyPerson(key);
}

export function searchPeople(query: string): Person[] {
  const merged = searchMergedPeople(query);
  const seen = new Set(merged.map((person) => person.person_key));
  const extra = searchMastarnasPeople(query).filter((person) => !seen.has(person.person_key));
  return [...merged, ...extra]
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "sv"))
    .slice(0, 50);
}

export type ResolvedResultRow = ResultRow & {
  resolved_person_key: string;
  resolved_name: string;
};

export function getResultsForEvent(eventId: number): ResultRow[] {
  return getResultsIndex().filter((row) => row.event_id === eventId);
}

export function getEventIdsWithUnreasonableTimes(): Set<number> {
  const eventIds = new Set<number>();
  for (const row of getResultsIndex()) {
    if (isUnreasonableTime(row.time)) {
      eventIds.add(row.event_id);
    }
  }
  return eventIds;
}

export function eventHasUnreasonableTimes(eventId: number): boolean {
  return getResultsForEvent(eventId).some((row) => isUnreasonableTime(row.time));
}

export function getResolvedResultsForEvent(eventId: number): ResolvedResultRow[] {
  return dedupeResultsByPerson(derivePlaces(getResultsForEvent(eventId))).map((row) => ({
    ...row,
    resolved_person_key: resolvePersonKey(row.person_key),
    resolved_name: resolveDisplayName(row.person_key, row.name),
  }));
}

export function findContentFile(id: number): { path: string; ext: string } | null {
  const local = findLocalContentFile(id);
  if (local) {
    return local;
  }

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

/** Blob URL when content lives in Vercel Blob (DB mode). */
export async function findContentUrl(id: number): Promise<string | null> {
  if (!useDbData()) {
    return null;
  }
  await ensureDbSnapshot();
  return readContentUrlFromDb(id);
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

/** True when DB snapshot is ready (or JSON mode). */
export function isDataReady(): boolean {
  if (!useDbData()) {
    return true;
  }
  return getDbSnapshotSync() !== null;
}
