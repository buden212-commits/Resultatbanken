import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { searchEventorForImport } from "@/lib/admin-data";
import { isEventorConfigured } from "@/lib/eventor";
import type { EventorSearchScope } from "@/lib/eventor";

const SCOPES = new Set<EventorSearchScope>(["club_entries", "club_organised", "all"]);

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const fromDate = String(searchParams.get("from") ?? "").trim();
    const toDate = String(searchParams.get("to") ?? "").trim();
    const scopeRaw = String(searchParams.get("scope") ?? "club_entries").trim();
    const query = String(searchParams.get("q") ?? "").trim();

    if (!SCOPES.has(scopeRaw as EventorSearchScope)) {
      return NextResponse.json({ error: "Ogiltig söktyp." }, { status: 400 });
    }

    const events = await searchEventorForImport({
      fromDate,
      toDate,
      scope: scopeRaw as EventorSearchScope,
      query,
    });

    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte söka i Eventor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
