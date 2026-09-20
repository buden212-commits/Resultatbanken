import fs from "fs";
import path from "path";

import { getDbSnapshotSync, useDbData } from "./db/store";

const EXCLUSIONS_PATH = path.join(process.cwd(), "..", "data", "stats-exclusions.json");

function normalizeIds(parsed: unknown): number[] {
  if (Array.isArray(parsed)) {
    return parsed.filter((id): id is number => typeof id === "number" && Number.isInteger(id));
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { event_ids?: unknown }).event_ids)) {
    return ((parsed as { event_ids: unknown[] }).event_ids).filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id),
    );
  }
  return [];
}

function readIds(): number[] {
  if (useDbData()) {
    return normalizeIds(getDbSnapshotSync()?.statsExclusions);
  }
  if (!fs.existsSync(EXCLUSIONS_PATH)) {
    return [];
  }
  return normalizeIds(JSON.parse(fs.readFileSync(EXCLUSIONS_PATH, "utf-8")));
}

export function getStatsExcludedEventIds(): number[] {
  return readIds();
}

export function isEventExcludedFromStats(eventId: number): boolean {
  return readIds().includes(eventId);
}

export function setStatsExcludedEventIds(eventIds: number[]): void {
  const unique = [...new Set(eventIds)].sort((a, b) => a - b);
  fs.writeFileSync(EXCLUSIONS_PATH, `${JSON.stringify(unique, null, 2)}\n`, "utf-8");
}

export function setEventStatsExcluded(eventId: number, excluded: boolean): number[] {
  const current = new Set(readIds());
  if (excluded) {
    current.add(eventId);
  } else {
    current.delete(eventId);
  }
  const next = [...current].sort((a, b) => a - b);
  setStatsExcludedEventIds(next);
  return next;
}
