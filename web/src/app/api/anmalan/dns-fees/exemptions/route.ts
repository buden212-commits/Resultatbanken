import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";

export async function POST(request: Request) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: "add" | "remove";
      eventId?: string;
    };
    const eventId = String(body.eventId ?? "").trim();
    if (!eventId || !/^\d+$/.test(eventId)) {
      return NextResponse.json({ error: "Ogiltigt tävlings-id." }, { status: 400 });
    }

    const data = await loadDnsFeeTracker();
    const set = new Set(data.exemptEventIds.map(String));
    if (body.action === "remove") {
      set.delete(eventId);
    } else {
      set.add(eventId);
    }
    data.exemptEventIds = [...set].sort((a, b) => a.localeCompare(b, "sv"));
    await saveDnsFeeTracker(data);
    return NextResponse.json({ ok: true, exemptEventIds: data.exemptEventIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara undantag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
