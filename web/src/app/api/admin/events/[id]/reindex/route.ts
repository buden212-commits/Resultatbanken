import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { reindexEventXmlResults } from "@/lib/admin-data";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const eventId = Number(id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return NextResponse.json({ error: "Ogiltigt event-id." }, { status: 400 });
    }

    const result = await reindexEventXmlResults(eventId);
    if (!result.deploy.ok) {
      return NextResponse.json(
        { error: result.deploy.message, ...result },
        { status: 422 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte indexera resultat.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
