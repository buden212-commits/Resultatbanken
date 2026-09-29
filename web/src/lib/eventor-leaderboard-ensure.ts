import { importEventorLeaderboards } from "./eventor-leaderboard-import";
import {
  clearEventorLeaderboardLock,
  loadEventorLeaderboards,
  saveEventorLeaderboardSnapshot,
  tryAcquireEventorLeaderboardLock,
} from "./eventor-leaderboard-store";
import {
  isEventorLeaderboardLockActive,
  isEventorLeaderboardStale,
  type EventorLeaderboardSnapshot,
} from "./eventor-leaderboard-types";
import { isEventorConfigured } from "./eventor";

export type EnsureEventorLeaderboardResult = {
  status: "fresh" | "refreshed" | "in_progress";
  message: string;
  snapshot: EventorLeaderboardSnapshot | null;
};

/**
 * Refresh club year leaderboards when missing/stale (>14 days).
 * Safe to call from a public page visit — skips if fresh or another refresh is running.
 */
export async function ensureEventorLeaderboardFresh(
  year: number,
): Promise<EnsureEventorLeaderboardResult> {
  if (!isEventorConfigured()) {
    throw new Error("Eventor är inte konfigurerat. Sätt EVENTOR_API_KEY.");
  }
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new Error("Ogiltigt år.");
  }

  const data = await loadEventorLeaderboards();
  const existing = data.byYear[String(year)] ?? null;

  if (!isEventorLeaderboardStale(existing)) {
    return {
      status: "fresh",
      message: "Topplistorna är redan uppdaterade.",
      snapshot: existing,
    };
  }

  if (isEventorLeaderboardLockActive(data.refreshLock, year)) {
    return {
      status: "in_progress",
      message: "Uppdatering från Eventor pågår redan.",
      snapshot: existing,
    };
  }

  const lock = await tryAcquireEventorLeaderboardLock(year);
  if (!lock.acquired) {
    return {
      status: "in_progress",
      message: "Uppdatering från Eventor pågår redan.",
      snapshot: lock.data.byYear[String(year)] ?? existing,
    };
  }

  // Re-check after acquiring lock — another instance may have finished.
  const latest = lock.data.byYear[String(year)] ?? null;
  if (!isEventorLeaderboardStale(latest)) {
    await clearEventorLeaderboardLock(year);
    return {
      status: "fresh",
      message: "Topplistorna är redan uppdaterade.",
      snapshot: latest,
    };
  }

  try {
    const result = await importEventorLeaderboards(year);
    await saveEventorLeaderboardSnapshot(result.snapshot);
    return {
      status: "refreshed",
      message: result.message,
      snapshot: result.snapshot,
    };
  } catch (error) {
    await clearEventorLeaderboardLock(year);
    throw error;
  }
}
