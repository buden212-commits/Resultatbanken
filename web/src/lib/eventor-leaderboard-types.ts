import type { EventorClubResultRow } from "./eventor-person";

export type EventorLeaderboardValueKind =
  | "count"
  | "duration"
  | "pace"
  | "km"
  | "percent"
  | "ratio"
  | "points";

export type EventorLeaderboardEntry = {
  personId: string;
  displayName: string;
  value: number;
  detail?: string;
};

export type EventorLeaderboardBoard = {
  id: string;
  title: string;
  subtitle: string;
  valueKind: EventorLeaderboardValueKind;
  entries: EventorLeaderboardEntry[];
};

export type EventorLeaderboardSnapshot = {
  year: number;
  importedAt: string;
  eventsScanned: number;
  personCount: number;
  resultCount: number;
  featured: EventorLeaderboardBoard[];
  classic: EventorLeaderboardBoard[];
  /** Raw year rows so UI can refilter MTBO/SkidO without re-import. */
  rows?: EventorClubResultRow[];
};

export type EventorLeaderboardRefreshLock = {
  year: number;
  startedAt: string;
};

export type EventorLeaderboardsData = {
  byYear: Record<string, EventorLeaderboardSnapshot>;
  refreshLock?: EventorLeaderboardRefreshLock | null;
};

export function emptyEventorLeaderboards(): EventorLeaderboardsData {
  return { byYear: {}, refreshLock: null };
}

/** Auto-refresh when a visitor opens the page and data is older than this. */
export const EVENTOR_LEADERBOARD_STALE_MS = 14 * 24 * 60 * 60 * 1000;

/** Ignore/steal refresh lock after this (crashed or timed-out import). */
export const EVENTOR_LEADERBOARD_LOCK_MS = 15 * 60 * 1000;

export function isEventorLeaderboardStale(
  snapshot: EventorLeaderboardSnapshot | null | undefined,
  now = Date.now(),
): boolean {
  if (!snapshot?.importedAt) return true;
  const importedAt = Date.parse(snapshot.importedAt);
  if (Number.isNaN(importedAt)) return true;
  return now - importedAt >= EVENTOR_LEADERBOARD_STALE_MS;
}

export function isEventorLeaderboardLockActive(
  lock: EventorLeaderboardRefreshLock | null | undefined,
  year: number,
  now = Date.now(),
): boolean {
  if (!lock || lock.year !== year) return false;
  const startedAt = Date.parse(lock.startedAt);
  if (Number.isNaN(startedAt)) return false;
  return now - startedAt < EVENTOR_LEADERBOARD_LOCK_MS;
}
