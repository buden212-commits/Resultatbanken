import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { saveEventResultList, type EditableResultInput } from "@/lib/result-list-data";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ error: "Saknar request body." }, { status: 400 });
    }

    let body: {
      event_id?: number;
      results?: EditableResultInput[];
    };

    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON i request body." }, { status: 400 });
    }

    const eventId = body.event_id;
    if (typeof eventId !== "number" || !Number.isInteger(eventId)) {
      return NextResponse.json({ error: "Ogiltigt event_id." }, { status: 400 });
    }
    if (!Array.isArray(body.results)) {
      return NextResponse.json({ error: "Saknar results-array." }, { status: 400 });
    }

    const result = await saveEventResultList(eventId, body.results);

    return NextResponse.json({
      ok: true,
      rowCount: result.rowCount,
      deploy: result.deploy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara resultatlistan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
