import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { importDnsFeesFromEventor } from "@/lib/dns-fee-import";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";
import { isEventorConfigured } from "@/lib/eventor";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }
  if (!isEventorConfigured()) {
    return NextResponse.json(
      { error: "Eventor är inte konfigurerat. Sätt EVENTOR_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { year?: number };
    const year = Number.isInteger(body.year) ? Number(body.year) : 2026;
    const existing = await loadDnsFeeTracker();
    const result = await importDnsFeesFromEventor(existing, year);
    await saveDnsFeeTracker(result.data);
    return NextResponse.json({
      ok: true,
      message: result.message,
      eventsScanned: result.eventsScanned,
      dnsRows: result.dnsRows,
      importedAt: result.data.importedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import misslyckades.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
