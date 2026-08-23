import fs from "fs";
import path from "path";

const EXCLUSIONS_PATH = path.join(process.cwd(), "..", "data", "stats-exclusions.json");

function readIds(): number[] {
  if (!fs.existsSync(EXCLUSIONS_PATH)) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(EXCLUSIONS_PATH, "utf-8")) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((id): id is number => typeof id === "number" && Number.isInteger(id));
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
