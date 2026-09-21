import { NextResponse } from "next/server";

import { getDeltagarePersonId } from "@/lib/deltagare-auth";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";
import { normalizeDnsFeeStatus } from "@/lib/dns-fee-types";

const MAX_REASON_LENGTH = 500;

export async function POST(request: Request) {
  const personId = await getDeltagarePersonId();
  if (!personId) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const body = (await request.json()) as { eventId?: string; reason?: string };
  const eventId = body.eventId?.trim() ?? "";
  const reason = (body.reason ?? "").trim();

  if (!eventId) {
    return NextResponse.json({ error: "Saknar tävling." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Ange en orsak." }, { status: 400 });
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json(
      { error: `Orsaken får vara högst ${MAX_REASON_LENGTH} tecken.` },
      { status: 400 },
    );
  }

  const data = await loadDnsFeeTracker();
  const index = data.rows.findIndex(
    (row) =>
      row.personId === personId &&
      row.eventId === eventId &&
      normalizeDnsFeeStatus(row.status) === "dns",
  );

  if (index < 0) {
    return NextResponse.json({ error: "DNS-starten hittades inte." }, { status: 404 });
  }

  const now = new Date().toISOString();
  data.rows[index] = {
    ...data.rows[index],
    dnsReason: reason,
    dnsReasonAt: now,
  };
  await saveDnsFeeTracker(data);

  return NextResponse.json({
    ok: true,
    row: {
      eventId: data.rows[index].eventId,
      eventName: data.rows[index].eventName,
      date: data.rows[index].date,
      className: data.rows[index].className,
      feeSek: data.rows[index].feeSek,
      dnsReason: data.rows[index].dnsReason,
      dnsReasonAt: data.rows[index].dnsReasonAt,
    },
  });
}
