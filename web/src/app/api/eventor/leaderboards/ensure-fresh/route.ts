import { NextResponse } from "next/server";

import { ensureEventorLeaderboardFresh } from "@/lib/eventor-leaderboard-ensure";
import { isEventorConfigured } from "@/lib/eventor";

export const maxDuration = 300;

/** Public: refresh year leaderboards only when missing or older than 14 days. */
export async function POST(request: Request) {
  if (!isEventorConfigured()) {
    return NextResponse.json(
      { error: "Eventor är inte konfigurerat. Sätt EVENTOR_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { year?: number };
    const year = Number.isInteger(body.year) ? Number(body.year) : new Date().getFullYear();
    const result = await ensureEventorLeaderboardFresh(year);
    return NextResponse.json({
      ok: true,
      status: result.status,
      message: result.message,
      year,
      importedAt: result.snapshot?.importedAt ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uppdatering misslyckades.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
