import { NextResponse } from "next/server";

import { isEventorConfigured } from "@/lib/eventor";
import { searchClubPersons } from "@/lib/eventor-person";

export const maxDuration = 30;

export async function GET(request: Request) {
  if (!isEventorConfigured()) {
    return NextResponse.json(
      { error: "Eventor är inte konfigurerat. Sätt EVENTOR_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const persons = await searchClubPersons(q, 25);
    return NextResponse.json({ persons });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte söka personer.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
