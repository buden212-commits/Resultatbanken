import { describe, expect, it } from "vitest";

import {
  emptyDnsFeeTracker,
  summarizeDnsFeesByPerson,
  type DnsFeeRow,
} from "./dns-fee-types";

function row(
  partial: Partial<DnsFeeRow> & Pick<DnsFeeRow, "personId" | "eventId" | "feeSek" | "status">,
): DnsFeeRow {
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
  it("waives DNS on exempt events but always charges DNF", () => {
    const data = emptyDnsFeeTracker(2026);
    data.exemptEventIds = ["100"];
    data.members = [
      { personId: "1", personName: "Anna" },
      { personId: "2", personName: "Bert" },
    ];
    data.rows = [
      row({ personId: "1", personName: "Anna", eventId: "100", feeSek: 200, status: "dns" }),
      row({ personId: "1", personName: "Anna", eventId: "100", feeSek: 200, status: "dnf" }),
      row({ personId: "1", personName: "Anna", eventId: "200", feeSek: 150, status: "dns" }),
      row({ personId: "2", personName: "Bert", eventId: "200", feeSek: 170, status: "dns" }),
    ];

    const people = summarizeDnsFeesByPerson(data);
    expect(people).toHaveLength(2);
    const anna = people.find((p) => p.personId === "1")!;
    expect(anna.dnsCount).toBe(3);
    expect(anna.feeSek).toBe(550);
    expect(anna.feeToPaySek).toBe(350);
    const bert = people.find((p) => p.personId === "2")!;
    expect(bert.feeToPaySek).toBe(170);
  });

  it("includes members without DNS/DNF", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [
      { personId: "1", personName: "Anna" },
      { personId: "3", personName: "Cecilia" },
    ];
    data.rows = [row({ personId: "1", personName: "Anna", eventId: "200", feeSek: 100, status: "dns" })];

    const people = summarizeDnsFeesByPerson(data);
    expect(people).toHaveLength(2);
    const cecilia = people.find((p) => p.personId === "3")!;
    expect(cecilia.dnsCount).toBe(0);
    expect(cecilia.feeSek).toBe(0);
    expect(cecilia.feeToPaySek).toBe(0);
    expect(cecilia.rows).toHaveLength(0);
  });
});
