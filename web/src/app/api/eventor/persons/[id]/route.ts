import { NextResponse } from "next/server";

import { isEventorConfigured } from "@/lib/eventor";
import { fetchPersonResults, getClubPerson } from "@/lib/eventor-person";
import {
  buildEventorPersonStats,
  filterResultsByYear,
} from "@/lib/eventor-person-stats";

export const maxDuration = 60;

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Props) {
  if (!isEventorConfigured()) {
    return NextResponse.json(
      { error: "Eventor är inte konfigurerat. Sätt EVENTOR_API_KEY." },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const yearRaw = url.searchParams.get("year");
    const year = yearRaw ? Number(yearRaw) : null;
    if (yearRaw && (!Number.isInteger(year) || year! < 1900 || year! > 2100)) {
      return NextResponse.json({ error: "Ogiltigt år." }, { status: 400 });
    }

    const person = await getClubPerson(id);
    if (!person) {
      return NextResponse.json({ error: "Personen hittades inte bland klubbens medlemmar." }, { status: 404 });
    }

    const allResults = await fetchPersonResults(id);
    const results = filterResultsByYear(allResults, year);
    const stats = buildEventorPersonStats(results);
    const allYears = buildEventorPersonStats(allResults).years;

    return NextResponse.json({
      person,
      year,
      years: allYears,
      stats,
      results,
      totalResults: allResults.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte hämta resultat.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
