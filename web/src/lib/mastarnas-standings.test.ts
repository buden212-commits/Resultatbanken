import { describe, expect, it } from "vitest";

import {
  attachPlaceDeltas,
  computeStandings,
  computeStandingsBeforeLatestEvent,
  latestScoringEvent,
  standingsForClass,
} from "./mastarnas-standings";
import type { MastarnasData, MastarnasSeason } from "./mastarnas-types";

const data: MastarnasData = {
  classes: [
    { id: "h21", name: "H21", is_youth: false },
    { id: "d21", name: "D21", is_youth: false },
  ],
  disciplines: [
    { id: "lang", name: "Lång", sort_order: 1, is_medel: false },
    { id: "medel", name: "Medel", sort_order: 2, is_medel: true },
    { id: "sprint", name: "Sprint", sort_order: 3, is_medel: false },
  ],
  seasons: [],
};

function seasonWithEvents(events: MastarnasSeason["events"]): MastarnasSeason {
  return { year: 2026, events };
}

describe("place deltas after latest event", () => {
  it("picks the latest scoring event by date", () => {
    const season = seasonWithEvents([
      {
        id: "e1",
        discipline_id: "lang",
        name: "Lång",
        date: "2026-04-01",
        results: [{ id: "r1", person_key: "anna", name: "Anna", class_id: "d21", place: 1, status: "ok", points: null }],
      },
      {
        id: "e2",
        discipline_id: "medel",
        name: "Medel",
        date: "2026-05-01",
        results: [{ id: "r2", person_key: "anna", name: "Anna", class_id: "d21", place: 1, status: "ok", points: null }],
      },
      {
        id: "e3",
        discipline_id: "sprint",
        name: "Sprint",
        date: "2026-03-01",
        results: [],
      },
    ]);

    expect(latestScoringEvent(season)?.id).toBe("e2");
  });

  it("computes previous standings and place deltas", () => {
    const season = seasonWithEvents([
      {
        id: "lang",
        discipline_id: "lang",
        name: "Lång",
        date: "2026-04-01",
        results: [
          { id: "a1", person_key: "anna", name: "Anna", class_id: "d21", place: 1, status: "ok", points: null },
          { id: "b1", person_key: "berit", name: "Berit", class_id: "d21", place: 2, status: "ok", points: null },
          { id: "c1", person_key: "cecilia", name: "Cecilia", class_id: "d21", place: 3, status: "ok", points: null },
        ],
      },
      {
        id: "medel",
        discipline_id: "medel",
        name: "Medel",
        date: "2026-05-01",
        results: [
          { id: "b2", person_key: "berit", name: "Berit", class_id: "d21", place: 1, status: "ok", points: null },
          { id: "c2", person_key: "cecilia", name: "Cecilia", class_id: "d21", place: 2, status: "ok", points: null },
          { id: "a2", person_key: "anna", name: "Anna", class_id: "d21", place: 3, status: "ok", points: null },
        ],
      },
    ]);

    const current = standingsForClass(computeStandings(data, season), "d21");
    const previous = standingsForClass(computeStandingsBeforeLatestEvent(data, season)!, "d21");
    const withDeltas = attachPlaceDeltas(current, previous);

    const byKey = Object.fromEntries(withDeltas.map((row) => [row.person_key, row]));
    expect(byKey.berit?.place).toBe(1);
    expect(byKey.berit?.placeDelta).toBeGreaterThan(0);
    expect(byKey.anna?.placeDelta).toBeLessThan(0);
  });

  it("returns null placeDelta for newcomers", () => {
    const withDeltas = attachPlaceDeltas(
      [
        {
          person_key: "ny",
          name: "Ny",
          class_id: "d21",
          class_name: "D21",
          is_youth: false,
          place: 2,
          total: 40,
          totalAll: 40,
          starts: 1,
          medel: 0,
          byDiscipline: {},
        },
      ],
      [
        {
          person_key: "gammal",
          name: "Gammal",
          class_id: "d21",
          class_name: "D21",
          is_youth: false,
          place: 1,
          total: 50,
          totalAll: 50,
          starts: 1,
          medel: 0,
          byDiscipline: {},
        },
      ],
    );

    expect(withDeltas[0]?.placeDelta).toBeNull();
  });
});
