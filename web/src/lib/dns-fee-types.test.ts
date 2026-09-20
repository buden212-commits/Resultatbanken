import { describe, expect, it } from "vitest";

import {
  emptyDnsFeeTracker,
  summarizeDnsFeesByPerson,
  type DnsFeeRow,
} from "./dns-fee-types";

function row(partial: Partial<DnsFeeRow> & Pick<DnsFeeRow, "personId" | "eventId" | "feeSek">): DnsFeeRow {
  return {
    personName: "Test Person",
    eventName: "Test",
    date: "2026-05-01",
    className: "H21",
    entryId: "1",
    ...partial,
  };
}

describe("dns fee summary", () => {
  it("sums fees per person and zeroes exempt events", () => {
    const data = emptyDnsFeeTracker(2026);
    data.exemptEventIds = ["100"];
    data.rows = [
      row({ personId: "1", personName: "Anna", eventId: "100", feeSek: 200 }),
      row({ personId: "1", personName: "Anna", eventId: "200", feeSek: 150 }),
      row({ personId: "2", personName: "Bert", eventId: "200", feeSek: 170 }),
    ];

    const people = summarizeDnsFeesByPerson(data);
    expect(people).toHaveLength(2);
    const anna = people.find((p) => p.personId === "1")!;
    expect(anna.dnsCount).toBe(2);
    expect(anna.feeSek).toBe(350);
    expect(anna.feeToPaySek).toBe(150);
    const bert = people.find((p) => p.personId === "2")!;
    expect(bert.feeToPaySek).toBe(170);
  });
});
