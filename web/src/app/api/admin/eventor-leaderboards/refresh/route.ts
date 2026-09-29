import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { importEventorLeaderboards } from "@/lib/eventor-leaderboard-import";
import { saveEventorLeaderboardSnapshot } from "@/lib/eventor-leaderboard-store";
import { isEventorConfigured } from "@/lib/eventor";

export const maxDuration = 300;

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
    const body = (await request.json().catch(() => ({}))) as { year?: number };
    const year = Number.isInteger(body.year) ? Number(body.year) : new Date().getFullYear();
    const result = await importEventorLeaderboards(year);
    await saveEventorLeaderboardSnapshot(result.snapshot);
    return NextResponse.json({
      ok: true,
      message: result.message,
      year: result.snapshot.year,
      importedAt: result.snapshot.importedAt,
      personCount: result.snapshot.personCount,
      resultCount: result.snapshot.resultCount,
      eventsScanned: result.snapshot.eventsScanned,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import misslyckades.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
