import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import { getDnsFeePersonDetail } from "@/lib/dns-fee-types";

type Props = {
  params: Promise<{ personId: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const { personId } = await params;
  const data = await loadDnsFeeTracker();
  const person = getDnsFeePersonDetail(data, personId);
  if (!person) {
    return NextResponse.json({ error: "Deltagaren hittades inte." }, { status: 404 });
  }

  return NextResponse.json({
    year: data.year,
    exemptEventIds: data.exemptEventIds,
    removedEventIds: data.removedEventIds ?? [],
    eventWaivers: data.eventWaivers ?? [],
    exemptFeeNames: data.exemptFeeNames ?? [],
    manualExemptions: data.manualExemptions ?? [],
    person,
  });
}
