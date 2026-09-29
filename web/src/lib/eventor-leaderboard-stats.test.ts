import { describe, expect, it } from "vitest";

import { buildEventorLeaderboardSnapshot } from "./eventor-leaderboard-stats";
import type { EventorClubResultRow } from "./eventor-person";

function row(
  partial: Partial<EventorClubResultRow> &
    Pick<EventorClubResultRow, "personId" | "displayName" | "eventId" | "date">,
): EventorClubResultRow {
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

describe("eventor leaderboard stats", () => {
  it("builds featured boards from club results", () => {
    const rows = [
      row({
        personId: "1",
        displayName: "Anna Allround",
        eventId: "a",
        date: "2026-03-01",
        place: 1,
        startsInClass: 20,
        distanceKind: "Sprint",
        classification: "Mästerskap",
      }),
      row({
        personId: "1",
        displayName: "Anna Allround",
        eventId: "b",
        date: "2026-04-01",
        place: 2,
        startsInClass: 20,
        distanceKind: "Medel",
        classification: "Nationell tävling",
      }),
      row({
        personId: "1",
        displayName: "Anna Allround",
        eventId: "c",
        date: "2026-05-01",
        place: 1,
        startsInClass: 10,
        distanceKind: "Lång",
        classification: "Distriktstävling",
      }),
      row({
        personId: "1",
        displayName: "Anna Allround",
        eventId: "d",
        date: "2026-08-01",
        place: 1,
        startsInClass: 20,
        kilometreTimeSeconds: 300,
        kilometreTime: "5:00",
        timeSeconds: 1500,
      }),
      row({
        personId: "1",
        displayName: "Anna Allround",
        eventId: "e",
        date: "2026-09-01",
        place: 1,
        startsInClass: 20,
        kilometreTimeSeconds: 310,
        kilometreTime: "5:10",
        timeSeconds: 1550,
      }),
      row({
        personId: "2",
        displayName: "Bert DNS",
        eventId: "f",
        date: "2026-03-01",
        status: "dns",
        place: null,
        time: null,
        timeSeconds: null,
        kilometreTime: null,
        kilometreTimeSeconds: null,
      }),
      row({
        personId: "2",
        displayName: "Bert DNS",
        eventId: "g",
        date: "2026-04-01",
        status: "dns",
        place: null,
        time: null,
        timeSeconds: null,
        kilometreTime: null,
        kilometreTimeSeconds: null,
      }),
      row({
        personId: "2",
        displayName: "Bert DNS",
        eventId: "h",
        date: "2026-05-01",
        status: "ok",
        place: 10,
        startsInClass: 10,
      }),
      row({
        personId: "2",
        displayName: "Bert DNS",
        eventId: "i",
        date: "2026-06-01",
        status: "ok",
        place: 9,
        startsInClass: 10,
      }),
      row({
        personId: "2",
        displayName: "Bert DNS",
        eventId: "j",
        date: "2026-07-01",
        status: "ok",
        place: 8,
        startsInClass: 10,
      }),
    ];

    const snapshot = buildEventorLeaderboardSnapshot(2026, rows, { eventsScanned: 10 });
    expect(snapshot.year).toBe(2026);
    expect(snapshot.personCount).toBe(2);
    expect(snapshot.featured.map((b) => b.id)).toContain("skogskm");
    expect(snapshot.featured.map((b) => b.id)).toContain("blixten");

    const starts = snapshot.classic.find((b) => b.id === "starter");
    expect(starts?.entries[0]?.personId).toBe("1");

    const finish = snapshot.featured.find((b) => b.id === "finishrate");
    expect(finish?.entries[0]?.personId).toBe("1");
  });

  it("excludes mtbo and skio by default", () => {
    const rows = [
      row({
        personId: "1",
        displayName: "Fot",
        eventId: "1",
        date: "2026-05-01",
        sportKind: "footo",
        place: 1,
        startsInClass: 10,
      }),
      row({
        personId: "1",
        displayName: "Fot",
        eventId: "2",
        date: "2026-05-02",
        sportKind: "footo",
        place: 1,
        startsInClass: 10,
      }),
      row({
        personId: "1",
        displayName: "Fot",
        eventId: "3",
        date: "2026-05-03",
        sportKind: "footo",
        place: 1,
        startsInClass: 10,
      }),
      row({
        personId: "1",
        displayName: "Fot",
        eventId: "4",
        date: "2026-05-04",
        sportKind: "footo",
        place: 1,
        startsInClass: 10,
      }),
      row({
        personId: "1",
        displayName: "Fot",
        eventId: "5",
        date: "2026-05-05",
        sportKind: "footo",
        place: 1,
        startsInClass: 10,
      }),
      row({
        personId: "2",
        displayName: "MTB",
        eventId: "6",
        date: "2026-06-01",
        eventName: "MTBO-KM",
        sportKind: "mtbo",
        place: 1,
        startsInClass: 5,
      }),
      row({
        personId: "3",
        displayName: "Skido",
        eventId: "7",
        date: "2026-01-01",
        eventName: "SkidoKM",
        sportKind: "skio",
        place: 1,
        startsInClass: 5,
      }),
    ];
    const snapshot = buildEventorLeaderboardSnapshot(2026, rows, { eventsScanned: 7 });
    const starts = snapshot.classic.find((b) => b.id === "starter");
    expect(starts?.entries.map((e) => e.personId)).toEqual(["1"]);
    expect(snapshot.rows).toHaveLength(7);
  });
});
