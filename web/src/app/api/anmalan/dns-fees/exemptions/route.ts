import { NextResponse } from "next/server";

import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker, saveDnsFeeTracker } from "@/lib/dns-fee-store";

function parseEventIds(body: { eventId?: string; eventIds?: string[] }): string[] {
  const fromArray = Array.isArray(body.eventIds)
    ? body.eventIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const single = String(body.eventId ?? "").trim();
  const ids = fromArray.length > 0 ? fromArray : single ? [single] : [];
  return [...new Set(ids.filter((id) => /^\d+$/.test(id)))];
}

export async function POST(request: Request) {
  if (!(await isAnmalanAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: "add" | "remove";
      eventId?: string;
      eventIds?: string[];
    };
    const eventIds = parseEventIds(body);
    if (eventIds.length === 0) {
      return NextResponse.json({ error: "Ogiltigt tävlings-id." }, { status: 400 });
    }

    const data = await loadDnsFeeTracker();
    const set = new Set(data.exemptEventIds.map(String));
    if (body.action === "remove") {
      for (const eventId of eventIds) set.delete(eventId);
    } else {
      for (const eventId of eventIds) set.add(eventId);
    }
    data.exemptEventIds = [...set].sort((a, b) => a.localeCompare(b, "sv"));
    await saveDnsFeeTracker(data);
    return NextResponse.json({ ok: true, exemptEventIds: data.exemptEventIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara undantag.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
