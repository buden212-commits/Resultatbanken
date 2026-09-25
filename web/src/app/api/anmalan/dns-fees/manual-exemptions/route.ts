import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";
import { manualExemptionKey } from "@/lib/dns-fee-types";

export async function POST(request: Request) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: "add" | "remove";
      personId?: string;
      eventId?: string;
    };
    const personId = String(body.personId ?? "").trim();
    const eventId = String(body.eventId ?? "").trim();
    if (!personId || !/^\d+$/.test(eventId)) {
      return NextResponse.json({ error: "Ogiltigt person- eller tävlings-id." }, { status: 400 });
    }

    const data = await loadDnsFeeTracker();
    const list = [...(data.manualExemptions ?? [])];
    const key = manualExemptionKey(personId, eventId);
    const index = list.findIndex(
      (item) => manualExemptionKey(item.personId, item.eventId) === key,
    );

    if (body.action === "remove") {
      if (index >= 0) list.splice(index, 1);
    } else if (index < 0) {
      list.push({
        personId,
        eventId,
        createdAt: new Date().toISOString(),
      });
    }

    data.manualExemptions = list.sort((a, b) => {
      const personCmp = a.personId.localeCompare(b.personId, "sv");
      if (personCmp !== 0) return personCmp;
      return a.eventId.localeCompare(b.eventId, "sv");
    });
    await saveDnsFeeTracker(data);
    return NextResponse.json({ ok: true, manualExemptions: data.manualExemptions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara manuellt undantag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
