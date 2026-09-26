import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import {
  listEventsFromRows,
  listFeeNameVariants,
  summarizeDnsFeesByPerson,
} from "@/lib/dns-fee-types";

export async function GET() {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const data = await loadDnsFeeTracker();
  const people = summarizeDnsFeesByPerson(data);
  const events = listEventsFromRows(data.rows);
  const feeNames = listFeeNameVariants(
    data.rows.filter((row) => !(data.removedEventIds ?? []).includes(row.eventId)),
  );

  return NextResponse.json({
    year: data.year,
    importedAt: data.importedAt,
    exemptEventIds: data.exemptEventIds,
    removedEventIds: data.removedEventIds ?? [],
    exemptFeeNames: data.exemptFeeNames ?? [],
    manualExemptions: data.manualExemptions ?? [],
    people,
    events,
    feeNames,
    totals: {
      people: people.length,
      dnsStarts: people.reduce((sum, row) => sum + row.dnsCount, 0),
      starts: people.reduce((sum, row) => sum + row.startCount, 0),
      entryFeeGrossSek: people.reduce((sum, row) => sum + row.entryFeeGrossSek, 0),
      lateFeeGrossSek: people.reduce((sum, row) => sum + row.lateFeeGrossSek, 0),
      otherFeeGrossSek: people.reduce((sum, row) => sum + row.otherFeeGrossSek, 0),
      dnsFeeGrossSek: people.reduce((sum, row) => sum + row.dnsFeeGrossSek, 0),
      totalGrossSek: people.reduce((sum, row) => sum + row.totalGrossSek, 0),
      entryFeeToPaySek: people.reduce((sum, row) => sum + row.entryFeeToPaySek, 0),
      lateFeeToPaySek: people.reduce((sum, row) => sum + row.lateFeeToPaySek, 0),
      otherFeeToPaySek: people.reduce((sum, row) => sum + row.otherFeeToPaySek, 0),
      dnsFeeToPaySek: people.reduce((sum, row) => sum + row.dnsFeeToPaySek, 0),
      totalToPaySek: people.reduce((sum, row) => sum + row.totalToPaySek, 0),
    },
  });
}
