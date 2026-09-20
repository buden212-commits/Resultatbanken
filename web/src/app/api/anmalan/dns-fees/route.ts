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
  const totalFee = people.reduce((sum, row) => sum + row.feeSek, 0);
  const totalToPay = people.reduce((sum, row) => sum + row.feeToPaySek, 0);

  return NextResponse.json({
    year: data.year,
    importedAt: data.importedAt,
    exemptEventIds: data.exemptEventIds,
    people,
    events,
    totals: {
      people: people.length,
      dnsStarts: data.rows.length,
      feeSek: totalFee,
      feeToPaySek: totalToPay,
    },
  });
}
