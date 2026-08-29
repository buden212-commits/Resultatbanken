import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { saveCorrectedResultTime } from "@/lib/result-time-data";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      event_id?: number;
      person_key?: string;
      class_name?: string | null;
      place?: number | null;
      time?: string;
      corrected_time?: string;
    };

    const eventId = body.event_id;
    const personKey = body.person_key?.trim() ?? "";
    const currentTime = body.time?.trim() ?? "";
    const correctedTime = body.corrected_time?.trim() ?? "";

    if (typeof eventId !== "number" || !Number.isInteger(eventId)) {
      return NextResponse.json({ error: "Ogiltigt event_id." }, { status: 400 });
    }
    if (!personKey) {
      return NextResponse.json({ error: "Saknar person_key." }, { status: 400 });
    }
    if (!currentTime) {
      return NextResponse.json({ error: "Saknar nuvarande tid." }, { status: 400 });
    }
    if (!correctedTime) {
      return NextResponse.json({ error: "Ange korrigerad tid." }, { status: 400 });
    }

    const className = body.class_name?.trim() ? body.class_name.trim() : null;
    const place = typeof body.place === "number" && Number.isInteger(body.place) ? body.place : null;

    const result = await saveCorrectedResultTime(
      {
        event_id: eventId,
        person_key: personKey,
        class_name: className,
        place,
        time: currentTime,
      },
      correctedTime,
    );

    return NextResponse.json({
      ok: true,
      time: result.time,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara tid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
