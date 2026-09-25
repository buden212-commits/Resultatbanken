import { describe, expect, it } from "vitest";

import {
  emptyDnsFeeTracker,
  isYouthOrJuniorClass,
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
    inSweden: true,
    ...partial,
  };
}

describe("isYouthOrJuniorClass", () => {
  it("matches youth and junior age classes", () => {
    expect(isYouthOrJuniorClass("H16")).toBe(true);
    expect(isYouthOrJuniorClass("D10")).toBe(true);
    expect(isYouthOrJuniorClass("H20")).toBe(true);
    expect(isYouthOrJuniorClass("D17-20")).toBe(true);
    expect(isYouthOrJuniorClass("H16E")).toBe(true);
    expect(isYouthOrJuniorClass("DH14")).toBe(true);
    expect(isYouthOrJuniorClass("Inskolning")).toBe(true);
    expect(isYouthOrJuniorClass("Öppen ungdom")).toBe(true);
  });

  it("rejects adult and open classes without age", () => {
    expect(isYouthOrJuniorClass("H21")).toBe(false);
    expect(isYouthOrJuniorClass("D35")).toBe(false);
    expect(isYouthOrJuniorClass("D17-34")).toBe(false);
    expect(isYouthOrJuniorClass("H21E")).toBe(false);
    expect(isYouthOrJuniorClass("Öppen")).toBe(false);
    expect(isYouthOrJuniorClass("–")).toBe(false);
  });
});

describe("dns fee summary", () => {
  it("splits anmälningsavgift and DNS cost; DNS always charged; DNF as entry fee", () => {
    const data = emptyDnsFeeTracker(2026);
    data.exemptEventIds = ["100"];
    data.members = [
      { personId: "1", personName: "Anna", email: null },
      { personId: "2", personName: "Bert", email: null },
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
    // entry: dnf 200 (always) + ok 150 = 350; dns always 200 + 100 = 300
    expect(anna.entryFeeToPaySek).toBe(350);
    expect(anna.dnsFeeToPaySek).toBe(300);
    expect(anna.totalToPaySek).toBe(650);
    expect(anna.dnsCount).toBe(2);

    const bert = people.find((p) => p.personId === "2")!;
    expect(bert.entryFeeToPaySek).toBe(170);
    expect(bert.dnsFeeToPaySek).toBe(0);
  });

  it("includes members without starts", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [
      { personId: "1", personName: "Anna", email: null },
      { personId: "3", personName: "Cecilia", email: null },
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
    data.members = [{ personId: "1", personName: "Anna", email: null }];
    data.rows = [row({ personId: "1", personName: "Anna", eventId: "50", feeSek: 300, status: "ok" })];
    const anna = summarizeDnsFeesByPerson(data)[0];
    expect(anna.entryFeeToPaySek).toBe(0);
    expect(anna.totalToPaySek).toBe(0);
  });

  it("waives entry fee for youth/junior classes in Sweden but always charges DNS", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [{ personId: "1", personName: "Ada", email: null }];
    data.rows = [
      row({
        personId: "1",
        personName: "Ada",
        eventId: "1",
        className: "D16",
        feeSek: 95,
        status: "ok",
      }),
      row({
        personId: "1",
        personName: "Ada",
        eventId: "2",
        className: "H18",
        feeSek: 150,
        status: "dnf",
      }),
      row({
        personId: "1",
        personName: "Ada",
        eventId: "3",
        className: "H20",
        feeSek: 180,
        status: "dns",
      }),
      row({
        personId: "1",
        personName: "Ada",
        eventId: "4",
        className: "H21",
        feeSek: 180,
        status: "ok",
      }),
    ];

    const ada = summarizeDnsFeesByPerson(data)[0];
    expect(ada.entryFeeToPaySek).toBe(180); // only H21
    expect(ada.dnsFeeToPaySek).toBe(180); // H20 DNS always
    expect(ada.totalToPaySek).toBe(360);
  });

  it("does not waive youth/junior fees for events outside Sweden", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [{ personId: "1", personName: "Ada", email: null }];
    data.rows = [
      row({
        personId: "1",
        personName: "Ada",
        eventId: "1",
        className: "D16",
        feeSek: 95,
        status: "ok",
        inSweden: false,
      }),
    ];
    const ada = summarizeDnsFeesByPerson(data)[0];
    expect(ada.entryFeeToPaySek).toBe(95);
  });

  it("splits ordinary anmälan vs efteranmälan vs övriga tillägg", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [{ personId: "1", personName: "Anna", email: null }];
    data.rows = [
      row({
        personId: "1",
        personName: "Anna",
        eventId: "1",
        feeSek: 390,
        status: "ok",
        fees: [
          {
            entryFeeId: "1",
            name: "Ordinarie anmälningsavgift",
            amountSek: 180,
            taxable: true,
            entryFeeType: null,
            validToDate: null,
          },
          {
            entryFeeId: "2",
            name: "Efteranmälan",
            amountSek: 90,
            taxable: false,
            entryFeeType: null,
            validToDate: null,
          },
          {
            entryFeeId: "3",
            name: "Beskattningsfri del SM",
            amountSek: 120,
            taxable: false,
            entryFeeType: null,
            validToDate: null,
          },
        ],
      }),
    ];
    const anna = summarizeDnsFeesByPerson(data)[0];
    expect(anna.entryFeeToPaySek).toBe(180);
    expect(anna.lateFeeToPaySek).toBe(90);
    expect(anna.otherFeeToPaySek).toBe(120);
    expect(anna.dnsFeeToPaySek).toBe(0);
    expect(anna.totalToPaySek).toBe(390);
  });
});
