import { NextResponse } from "next/server";

import { updateEventType } from "@/lib/admin-data";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      event_id?: number;
      type?: string;
    };

    const eventId = body.event_id;
    const type = body.type?.trim() ?? "";

    if (typeof eventId !== "number" || !Number.isInteger(eventId)) {
      return NextResponse.json({ error: "Ogiltigt event_id." }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: "Typ krävs." }, { status: 400 });
    }

    const result = await updateEventType(eventId, type);

    return NextResponse.json({
      ok: true,
      type: result.event.type,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara typ.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
