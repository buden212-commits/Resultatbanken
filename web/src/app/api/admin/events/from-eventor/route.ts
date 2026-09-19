import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createEventFromEventor } from "@/lib/admin-data";
import { isEventorConfigured } from "@/lib/eventor";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  if (!isEventorConfigured()) {
    return NextResponse.json(
      { error: "Eventor är inte konfigurerat. Sätt EVENTOR_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      eventorId?: string;
      type?: string;
      free_text?: string;
      resultsScope?: "club" | "full";
    };

    const eventorId = String(body.eventorId ?? "").trim();
    if (!eventorId) {
      return NextResponse.json({ error: "Eventor-id krävs." }, { status: 400 });
    }

    const result = await createEventFromEventor(eventorId, {
      type: body.type,
      free_text: body.free_text,
      resultsScope: body.resultsScope === "club" ? "club" : "full",
    });

    return NextResponse.json({
      id: result.event.id,
      url: `/resultat/${result.event.id}`,
      eventorId: result.eventorId,
      name: result.event.name,
      resultCountHint: result.resultCountHint,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte importera från Eventor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
