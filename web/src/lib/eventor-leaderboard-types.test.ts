import { describe, expect, it } from "vitest";

import {
  isEventorLeaderboardLockActive,
  isEventorLeaderboardStale,
  EVENTOR_LEADERBOARD_STALE_MS,
} from "./eventor-leaderboard-types";

describe("eventor leaderboard freshness", () => {
  it("treats missing snapshot as stale", () => {
    expect(isEventorLeaderboardStale(null)).toBe(true);
  });

  it("treats recent import as fresh", () => {
    const now = Date.parse("2026-09-29T12:00:00.000Z");
    expect(
      isEventorLeaderboardStale(
        {
          year: 2026,
          importedAt: "2026-09-20T12:00:00.000Z",
          eventsScanned: 1,
          personCount: 1,
          resultCount: 1,
          featured: [],
          classic: [],
        },
        now,
      ),
    ).toBe(false);
  });

  it("treats 14-day-old import as stale", () => {
    const now = Date.parse("2026-09-29T12:00:00.000Z");
    expect(
      isEventorLeaderboardStale(
        {
          year: 2026,
          importedAt: new Date(now - EVENTOR_LEADERBOARD_STALE_MS).toISOString(),
          eventsScanned: 1,
          personCount: 1,
          resultCount: 1,
          featured: [],
          classic: [],
        },
        now,
      ),
    ).toBe(true);
  });

  it("detects active refresh lock", () => {
    const now = Date.parse("2026-09-29T12:00:00.000Z");
    expect(
      isEventorLeaderboardLockActive(
        { year: 2026, startedAt: "2026-09-29T11:55:00.000Z" },
        2026,
        now,
      ),
    ).toBe(true);
    expect(
      isEventorLeaderboardLockActive(
        { year: 2026, startedAt: "2026-09-29T11:00:00.000Z" },
        2026,
        now,
      ),
    ).toBe(false);
  });
});
