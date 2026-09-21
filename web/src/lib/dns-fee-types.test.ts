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
  it("splits anmälningsavgift and DNS cost; DNF always pays as entry fee", () => {
    const data = emptyDnsFeeTracker(2026);
    data.exemptEventIds = ["100"];
    data.members = [
      { personId: "1", personName: "Anna" },
      { personId: "2", personName: "Bert" },
    ];
    data.rows = [
      row({ personId: "1", personName: "Anna", eventId: "100", feeSek: 200, status: "dns" }),
      row({ personId: "1", personName: "Anna", eventId: "100", feeSek: 200, status: "dnf" }),
      row({ personId: "1", personName: "Anna", eventId: "200", feeSek: 150, status: "ok" }),
      row({ personId: "1", personName: "Anna", eventId: "300", feeSek: 100, status: "dns" }),
      row({ personId: "2", personName: "Bert", eventId: "200", feeSek: 170, status: "ok" }),
    ];

    const people = summarizeDnsFeesByPerson(data);
    const anna = people.find((p) => p.personId === "1")!;
    // entry: dnf 200 (always) + ok 150 = 350; dns exempt 0 + dns 100 = 100
    expect(anna.entryFeeToPaySek).toBe(350);
    expect(anna.dnsFeeToPaySek).toBe(100);
    expect(anna.totalToPaySek).toBe(450);
    expect(anna.dnsCount).toBe(2);

    const bert = people.find((p) => p.personId === "2")!;
    expect(bert.entryFeeToPaySek).toBe(170);
    expect(bert.dnsFeeToPaySek).toBe(0);
  });

  it("includes members without starts", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [
      { personId: "1", personName: "Anna" },
      { personId: "3", personName: "Cecilia" },
    ];
    data.rows = [row({ personId: "1", personName: "Anna", eventId: "200", feeSek: 100, status: "ok" })];

    const people = summarizeDnsFeesByPerson(data);
    expect(people).toHaveLength(2);
    const cecilia = people.find((p) => p.personId === "3")!;
    expect(cecilia.startCount).toBe(0);
    expect(cecilia.entryFeeToPaySek).toBe(0);
    expect(cecilia.dnsFeeToPaySek).toBe(0);
  });

  it("waives OK fees on exempt events", () => {
    const data = emptyDnsFeeTracker(2026);
    data.exemptEventIds = ["50"];
    data.members = [{ personId: "1", personName: "Anna" }];
    data.rows = [row({ personId: "1", personName: "Anna", eventId: "50", feeSek: 300, status: "ok" })];
    const anna = summarizeDnsFeesByPerson(data)[0];
    expect(anna.entryFeeToPaySek).toBe(0);
    expect(anna.totalToPaySek).toBe(0);
  });
});
