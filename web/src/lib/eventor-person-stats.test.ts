import { describe, expect, it } from "vitest";

import { buildEventorPersonStats, filterResultsByYear } from "./eventor-person-stats";
import type { EventorPersonResult } from "./eventor-person";

function row(partial: Partial<EventorPersonResult> & Pick<EventorPersonResult, "eventId" | "date">): EventorPersonResult {
  return {
    eventName: "Test",
    organizer: "IFK Mora OK",
    classification: "Nationell tävling",
    className: "H40",
    place: 3,
    time: "26:33",
    timeSeconds: 1593,
    timeDiff: "2:04",
    kilometreTime: "6:14",
    kilometreTimeSeconds: 374,
    status: "ok",
    statusRaw: "OK",
    distanceKind: "Medel",
    startsInClass: 24,
    eventUrl: "https://eventor.orientering.se/Events/Show/1",
    isTeam: false,
    ...partial,
  };
}

describe("eventor person stats", () => {
  it("aggregates starts, places and km times", () => {
    const results = [
      row({ eventId: "1", date: "2024-05-01", place: 1, kilometreTimeSeconds: 360 }),
      row({ eventId: "2", date: "2024-06-01", place: 5, kilometreTimeSeconds: 400 }),
      row({ eventId: "3", date: "2023-05-01", status: "dns", place: null, time: null, timeSeconds: null, kilometreTime: null, kilometreTimeSeconds: null }),
    ];
    const stats = buildEventorPersonStats(results);
    expect(stats.starts).toBe(3);
    expect(stats.finished).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.dns).toBe(1);
    expect(stats.bestPlace).toBe(1);
    expect(stats.bestKilometreTimeSeconds).toBe(360);
    expect(stats.resultsByYear.map((y) => y.year)).toEqual(["2023", "2024"]);
  });

  it("filters by year", () => {
    const results = [
      row({ eventId: "1", date: "2024-01-01" }),
      row({ eventId: "2", date: "2023-01-01" }),
    ];
    expect(filterResultsByYear(results, 2024)).toHaveLength(1);
    expect(filterResultsByYear(results, null)).toHaveLength(2);
  });
});
