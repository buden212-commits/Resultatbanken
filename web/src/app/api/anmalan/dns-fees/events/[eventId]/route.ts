import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import { getDnsFeeEventDetail } from "@/lib/dns-fee-types";

type Props = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const { eventId } = await params;
  const data = await loadDnsFeeTracker();
  const event = getDnsFeeEventDetail(data, eventId);
  if (!event) {
    return NextResponse.json({ error: "Tävlingen hittades inte." }, { status: 404 });
  }

  return NextResponse.json({
    year: data.year,
    exemptEventIds: data.exemptEventIds,
    removedEventIds: data.removedEventIds ?? [],
    eventWaivers: data.eventWaivers ?? [],
    exemptFeeNames: data.exemptFeeNames ?? [],
    manualExemptions: data.manualExemptions ?? [],
    event,
  });
}
