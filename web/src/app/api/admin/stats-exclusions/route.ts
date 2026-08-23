import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getEvent } from "@/lib/data";
import { saveEventStatsExclusion } from "@/lib/stats-exclusion-data";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      event_id?: number;
      excluded?: boolean;
    };

    const eventId = body.event_id;
    const excluded = body.excluded;

    if (typeof eventId !== "number" || !Number.isInteger(eventId)) {
      return NextResponse.json({ error: "Ogiltigt event_id." }, { status: 400 });
    }
    if (typeof excluded !== "boolean") {
      return NextResponse.json({ error: "Saknar excluded (boolean)." }, { status: 400 });
    }

    const event = getEvent(eventId);
    if (!event) {
      return NextResponse.json({ error: "Eventet finns inte." }, { status: 404 });
    }

    const eventName = event.name || event.type || `Resultat ${event.id}`;
    const result = await saveEventStatsExclusion(eventId, excluded, eventName);

    return NextResponse.json({
      ok: true,
      excluded,
      excluded_event_ids: result.excluded_event_ids,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara inställning.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
