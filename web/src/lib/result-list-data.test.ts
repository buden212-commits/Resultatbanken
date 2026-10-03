import { describe, expect, it } from "vitest";

import { normalizeEditableResults } from "./result-list-data";

describe("normalizeEditableResults", () => {
  it("normalizes names, keys, empty fields and statuses", () => {
    const rows = normalizeEditableResults(10, [
      {
        name: " Anna Andersson ",
        club: " OK Linne ",
        class_name: " D21 ",
        place: 1,
        time: " 45:30 ",
        status: null,
      },
      {
        name: "Björn Berg",
        person_key: "bjorn-berg",
        status: "DNS",
        place: 3,
        time: "12:00",
      },
      {
        name: "Cecilia Carlsson",
        status: "ok",
        place: 2,
        time: "46:10",
        club: "",
        class_name: "",
      },
    ]);

    expect(rows).toEqual([
      {
        event_id: 10,
        person_key: "anna-andersson",
        name: "Anna Andersson",
        club: "OK Linne",
        class_name: "D21",
        place: 1,
        time: "45:30",
        status: null,
        parse_source: "manual",
        parse_confidence: "high",
      },
      {
        event_id: 10,
        person_key: "bjorn-berg",
        name: "Björn Berg",
        club: null,
        class_name: null,
        place: null,
        time: null,
        status: "dns",
        parse_source: "manual",
        parse_confidence: "high",
      },
      {
        event_id: 10,
        person_key: "cecilia-carlsson",
        name: "Cecilia Carlsson",
        club: null,
        class_name: null,
        place: 2,
        time: "46:10",
        status: null,
        parse_source: "manual",
        parse_confidence: "high",
      },
    ]);
  });

  it("rejects empty names", () => {
    expect(() => normalizeEditableResults(1, [{ name: "  " }])).toThrow(/namn krävs/);
  });
});
