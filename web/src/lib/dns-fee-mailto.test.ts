import { describe, expect, it } from "vitest";

import { buildFeeMailtoLink } from "./dns-fee-mailto";
import type { DnsFeePersonSummary } from "./dns-fee-types";

describe("buildFeeMailtoLink", () => {
  it("returns null without email", () => {
    const person: DnsFeePersonSummary = {
      personId: "1",
      personName: "Anna Test",
      email: null,
      dnsCount: 0,
      startCount: 0,
      entryFeeToPaySek: 0,
      lateFeeToPaySek: 0,
      otherFeeToPaySek: 0,
      dnsFeeToPaySek: 0,
      totalToPaySek: 0,
      feeSek: 0,
      rows: [],
    };
    expect(buildFeeMailtoLink(person, [])).toBeNull();
  });

  it("builds mailto with subject and cost summary", () => {
    const person: DnsFeePersonSummary = {
      personId: "1",
      personName: "Anna Test",
      email: "anna@example.com",
      dnsCount: 1,
      startCount: 2,
      entryFeeToPaySek: 150,
      lateFeeToPaySek: 50,
      otherFeeToPaySek: 120,
      dnsFeeToPaySek: 200,
      totalToPaySek: 520,
      feeSek: 520,
      rows: [
        {
          personId: "1",
          personName: "Anna Test",
          eventId: "10",
          eventName: "Medel-KM",
          date: "2026-05-01",
          className: "D35",
          status: "ok",
          feeSek: 320,
          fees: [
            {
              entryFeeId: "1",
              name: "Ordinarie anmälningsavgift",
              amountSek: 150,
              taxable: true,
              entryFeeType: null,
              validToDate: null,
            },
            {
              entryFeeId: "2",
              name: "Efteranmälan",
              amountSek: 50,
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
          entryId: "1",
        },
        {
          personId: "1",
          personName: "Anna Test",
          eventId: "20",
          eventName: "Natt-KM",
          date: "2026-06-01",
          className: "D35",
          status: "dns",
          feeSek: 200,
          entryId: "2",
        },
      ],
    };
    const href = buildFeeMailtoLink(person, [], 2026);
    expect(href).toContain("mailto:anna@example.com");
    expect(href).toContain(encodeURIComponent("Startavgifter och Ej start"));
    const decoded = decodeURIComponent(href!.split("?")[1] ?? "");
    expect(decoded).toContain("Anmälan (ordinarie): 150 kr");
    expect(decoded).toContain("Efteranmälan: 50 kr");
    expect(decoded).toContain("Övriga tillägg: 120 kr");
    expect(decoded).toContain("Ej start (DNS): 200 kr");
    expect(decoded).toContain("Totalt att betala: 520 kr");
    expect(decoded).toContain("Medel-KM");
    expect(decoded).toContain("Natt-KM");
  });

  it("omits manually exempted starts from mail body and totals stay as provided", () => {
    const person: DnsFeePersonSummary = {
      personId: "1",
      personName: "Anna Test",
      email: "anna@example.com",
      dnsCount: 1,
      startCount: 2,
      entryFeeToPaySek: 150,
      lateFeeToPaySek: 0,
      otherFeeToPaySek: 0,
      dnsFeeToPaySek: 0,
      totalToPaySek: 150,
      feeSek: 350,
      rows: [
        {
          personId: "1",
          personName: "Anna Test",
          eventId: "10",
          eventName: "Medel-KM",
          date: "2026-05-01",
          className: "D35",
          status: "ok",
          feeSek: 150,
          entryId: "1",
        },
        {
          personId: "1",
          personName: "Anna Test",
          eventId: "20",
          eventName: "Natt-KM",
          date: "2026-06-01",
          className: "D35",
          status: "dns",
          feeSek: 200,
          entryId: "2",
        },
      ],
    };
    const href = buildFeeMailtoLink(
      person,
      [],
      2026,
      [{ personId: "1", eventId: "20", createdAt: "2026-01-01T00:00:00.000Z" }],
    );
    const decoded = decodeURIComponent(href!.split("?")[1] ?? "");
    expect(decoded).toContain("Medel-KM");
    expect(decoded).not.toContain("Natt-KM");
    expect(decoded).not.toContain("manuellt");
    expect(decoded).not.toContain("undantag");
  });
});
