import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import {
  listEventsFromRows,
  summarizeDnsFeesByPerson,
} from "@/lib/dns-fee-types";

export async function GET() {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const data = await loadDnsFeeTracker();
  const people = summarizeDnsFeesByPerson(data);
  const events = listEventsFromRows(data.rows);

  return NextResponse.json({
    year: data.year,
    importedAt: data.importedAt,
    exemptEventIds: data.exemptEventIds,
    people,
    events,
    totals: {
      people: people.length,
      dnsStarts: people.reduce((sum, row) => sum + row.dnsCount, 0),
      starts: people.reduce((sum, row) => sum + row.startCount, 0),
      entryFeeToPaySek: people.reduce((sum, row) => sum + row.entryFeeToPaySek, 0),
      dnsFeeToPaySek: people.reduce((sum, row) => sum + row.dnsFeeToPaySek, 0),
      totalToPaySek: people.reduce((sum, row) => sum + row.totalToPaySek, 0),
    },
  });
}
