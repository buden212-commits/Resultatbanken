import { NextResponse } from "next/server";

import {
  findDeltagareByPersonId,
  getDeltagarePersonId,
} from "@/lib/deltagare-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import { normalizeDnsFeeStatus } from "@/lib/dns-fee-types";

export async function GET() {
  const personId = await getDeltagarePersonId();
  if (!personId) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const data = await loadDnsFeeTracker();
  const person = findDeltagareByPersonId(data, personId);
  if (!person) {
    return NextResponse.json({ error: "Deltagaren hittades inte." }, { status: 404 });
  }

  const dnsRows = data.rows
    .filter((row) => row.personId === personId && normalizeDnsFeeStatus(row.status) === "dns")
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.eventName.localeCompare(b.eventName, "sv");
    })
    .map((row) => ({
      eventId: row.eventId,
      eventName: row.eventName,
      date: row.date,
      className: row.className,
      feeSek: row.feeSek,
      dnsReason: row.dnsReason ?? null,
      dnsReasonAt: row.dnsReasonAt ?? null,
    }));

  return NextResponse.json({
    year: data.year,
    person,
    dnsRows,
  });
}
