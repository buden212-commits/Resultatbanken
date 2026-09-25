import { describe, expect, it } from "vitest";

import { parseEntryFeeDefinitions } from "./dns-fee-import";
import { describeDnsFeePart } from "./dns-fee-types";

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<EntryFeeList>
  <EntryFee taxIncluded="Y" entryFeeType="normal" type="normal">
    <EntryFeeId>1</EntryFeeId>
    <Name>Ordinarie anmälningsavgift</Name>
    <Amount currency="SEK">180</Amount>
    <ValidToDate><Date>2026-05-01</Date><Clock>23:59:59</Clock></ValidToDate>
  </EntryFee>
  <EntryFee taxIncluded="N" entryFeeType="normal" type="normal">
    <EntryFeeId>2</EntryFeeId>
    <Name>Efteranmälan</Name>
    <Amount currency="SEK">90</Amount>
    <ValidToDate><Date>2026-05-05</Date><Clock>23:59:59</Clock></ValidToDate>
  </EntryFee>
  <EntryFee taxIncluded="N">
    <EntryFeeId>3</EntryFeeId>
    <Name>Beskattningsfri del SM</Name>
    <Amount currency="SEK">120</Amount>
  </EntryFee>
</EntryFeeList>`;

describe("parseEntryFeeDefinitions", () => {
  it("parses name, amount, taxable and dates", () => {
    const map = parseEntryFeeDefinitions(SAMPLE);
    expect(map.size).toBe(3);
    expect(map.get("1")).toMatchObject({
      name: "Ordinarie anmälningsavgift",
      amountSek: 180,
      taxable: true,
      validToDate: "2026-05-01",
    });
    expect(map.get("2")).toMatchObject({
      name: "Efteranmälan",
      amountSek: 90,
      taxable: false,
    });
  });
});

describe("describeDnsFeePart", () => {
  it("classifies ordinary, late and other fees from name/flag", () => {
    expect(
      describeDnsFeePart({
        entryFeeId: "1",
        name: "Ordinarie anmälningsavgift",
        amountSek: 180,
        taxable: true,
        entryFeeType: null,
        validToDate: null,
      }),
    ).toBe("Ordinarie / grundavgift");

    expect(
      describeDnsFeePart({
        entryFeeId: "2",
        name: "Efteranmälan",
        amountSek: 90,
        taxable: false,
        entryFeeType: null,
        validToDate: null,
      }),
    ).toBe("Efteranmälan");

    expect(
      describeDnsFeePart({
        entryFeeId: "3",
        name: "Beskattningsfri del SM",
        amountSek: 120,
        taxable: false,
        entryFeeType: null,
        validToDate: null,
      }),
    ).toBe("Övrigt tillägg");

    expect(
      describeDnsFeePart({
        entryFeeId: "4",
        name: "Ordinarie anmälningsavgift ungdom",
        amountSek: 95,
        taxable: true,
        entryFeeType: null,
        validToDate: null,
      }),
    ).toBe("Ordinarie / grundavgift");
  });
});
