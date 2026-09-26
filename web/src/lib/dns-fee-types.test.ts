import { describe, expect, it } from "vitest";

import {
  emptyDnsFeeTracker,
  isYouthOrJuniorClass,
  listFeeNameVariants,
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

  it("excludes people with 0 kr gross fees", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [
      { personId: "1", personName: "Anna", email: null },
      { personId: "3", personName: "Cecilia", email: null },
    ];
    data.rows = [row({ personId: "1", personName: "Anna", eventId: "200", feeSek: 100, status: "ok" })];

    const people = summarizeDnsFeesByPerson(data);
    expect(people).toHaveLength(1);
    expect(people[0].personId).toBe("1");
    expect(people[0].entryFeeGrossSek).toBe(100);
    expect(people[0].totalGrossSek).toBe(100);
  });

  it("waives only ordinary fees on exempt events; late/other still charged", () => {
    const data = emptyDnsFeeTracker(2026);
    data.exemptEventIds = ["50"];
    data.members = [{ personId: "1", personName: "Anna", email: null }];
    data.rows = [
      row({
        personId: "1",
        personName: "Anna",
        eventId: "50",
        feeSek: 270,
        status: "ok",
        fees: [
          {
            entryFeeId: "1",
            name: "Ordinarie anmälningsavgift",
            amountSek: 220,
            taxable: true,
            entryFeeType: null,
            validToDate: null,
          },
          {
            entryFeeId: "2",
            name: "Efteranmälningsavgift",
            amountSek: 50,
            taxable: false,
            entryFeeType: null,
            validToDate: null,
          },
        ],
      }),
    ];
    const anna = summarizeDnsFeesByPerson(data)[0];
    expect(anna.entryFeeToPaySek).toBe(0);
    expect(anna.lateFeeToPaySek).toBe(50);
    expect(anna.otherFeeToPaySek).toBe(0);
    expect(anna.totalToPaySek).toBe(50);
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

  it("applies per-column manual waiver checkboxes on top of base rules", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [{ personId: "1", personName: "Anna", email: null }];
    data.manualExemptions = [
      {
        personId: "1",
        eventId: "10",
        createdAt: "2026-01-01T00:00:00.000Z",
        waiveAnmalan: false,
        waiveLate: false,
        waiveOther: false,
        waiveDns: true,
      },
      {
        personId: "1",
        eventId: "20",
        createdAt: "2026-01-01T00:00:00.000Z",
        waiveAnmalan: true,
        waiveLate: true,
        waiveOther: false,
        waiveDns: false,
      },
    ];
    data.rows = [
      row({
        personId: "1",
        personName: "Anna",
        eventId: "10",
        feeSek: 250,
        status: "dns",
        fees: [
          {
            entryFeeId: "1",
            name: "Ordinarie",
            amountSek: 200,
            taxable: true,
            entryFeeType: null,
            validToDate: null,
          },
          {
            entryFeeId: "2",
            name: "Efteranmälningsavgift",
            amountSek: 50,
            taxable: false,
            entryFeeType: null,
            validToDate: null,
          },
        ],
      }),
      row({
        personId: "1",
        personName: "Anna",
        eventId: "20",
        feeSek: 150,
        status: "ok",
        fees: [
          {
            entryFeeId: "3",
            name: "Ordinarie",
            amountSek: 100,
            taxable: true,
            entryFeeType: null,
            validToDate: null,
          },
          {
            entryFeeId: "4",
            name: "Efteranmälan",
            amountSek: 50,
            taxable: false,
            entryFeeType: null,
            validToDate: null,
          },
        ],
      }),
    ];
    const anna = summarizeDnsFeesByPerson(data)[0];
    expect(anna.dnsFeeToPaySek).toBe(0);
    expect(anna.entryFeeToPaySek).toBe(0);
    expect(anna.lateFeeToPaySek).toBe(0);
    expect(anna.totalToPaySek).toBe(0);
  });

  it("waives exact fee names listed in exemptFeeNames", () => {
    const data = emptyDnsFeeTracker(2026);
    data.members = [{ personId: "1", personName: "Ada", email: null }];
    data.exemptFeeNames = [
      "Anmälningsavgift ungdom avgiftfri",
      "Ordinarie anmälningsavgift ungdom",
    ];
    data.rows = [
      row({
        personId: "1",
        personName: "Ada",
        eventId: "1",
        className: "H21",
        feeSek: 180,
        status: "ok",
        fees: [
          {
            entryFeeId: "1",
            name: "Anmälningsavgift ungdom avgiftfri",
            amountSek: 180,
            taxable: true,
            entryFeeType: null,
            validToDate: null,
          },
        ],
      }),
      row({
        personId: "1",
        personName: "Ada",
        eventId: "2",
        className: "H21",
        feeSek: 95,
        status: "ok",
        fees: [
          {
            entryFeeId: "2",
            name: "Ordinarie anmälningsavgift ungdom",
            amountSek: 95,
            taxable: true,
            entryFeeType: null,
            validToDate: null,
          },
        ],
      }),
      row({
        personId: "1",
        personName: "Ada",
        eventId: "3",
        className: "H21",
        feeSek: 180,
        status: "dns",
        fees: [
          {
            entryFeeId: "3",
            name: "Ordinarie anmälningsavgift ungdom",
            amountSek: 180,
            taxable: true,
            entryFeeType: null,
            validToDate: null,
          },
        ],
      }),
    ];
    const ada = summarizeDnsFeesByPerson(data)[0];
    expect(ada.entryFeeToPaySek).toBe(0);
    expect(ada.dnsFeeToPaySek).toBe(0);
    expect(ada.totalToPaySek).toBe(0);
  });

  it("lists unique fee name variants", () => {
    const data = emptyDnsFeeTracker(2026);
    data.rows = [
      row({
        personId: "1",
        eventId: "1",
        feeSek: 270,
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
        ],
      }),
      row({
        personId: "2",
        eventId: "2",
        feeSek: 180,
        status: "ok",
        fees: [
          {
            entryFeeId: "3",
            name: "Ordinarie anmälningsavgift",
            amountSek: 180,
            taxable: true,
            entryFeeType: null,
            validToDate: null,
          },
        ],
      }),
    ];
    const variants = listFeeNameVariants(data.rows);
    expect(variants).toHaveLength(2);
    expect(variants[0].name).toBe("Efteranmälan");
    expect(variants[0].participants).toHaveLength(1);
    expect(variants[1]).toMatchObject({
      name: "Ordinarie anmälningsavgift",
      count: 2,
      totalSek: 360,
      kind: "ordinary",
    });
    expect(variants[1].participants).toHaveLength(2);
    expect(variants[1].participants.map((p) => p.personId)).toEqual(["1", "2"]);
  });
});
