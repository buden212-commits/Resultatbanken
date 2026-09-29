import type { Metadata } from "next";
import Link from "next/link";

import { EventorLeaderboardsPanel } from "@/components/EventorLeaderboardsPanel";
import { PageHeader } from "@/components/PageHeader";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { loadEventorLeaderboards } from "@/lib/eventor-leaderboard-store";
import { isEventorLeaderboardStale } from "@/lib/eventor-leaderboard-types";
import { isEventorConfigured } from "@/lib/eventor";

export const metadata: Metadata = {
  title: "Eventor-topplistor — Resultatbanken",
  description: "Ovanliga klubbtopplistor från Eventor för IFK Mora OK — senaste året.",
};

type Props = {
  searchParams: Promise<{ year?: string }>;
};

export default async function EventorLeaderboardsPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;
  const configured = isEventorConfigured();
  const currentYear = new Date().getFullYear();
  const requested = yearParam ? Number(yearParam) : currentYear;
  const year = Number.isInteger(requested) ? requested : currentYear;

  const data = configured ? await loadEventorLeaderboards() : { byYear: {} };
  const snapshot = data.byYear[String(year)] ?? null;
  const needsRefresh = configured && isEventorLeaderboardStale(snapshot);
  const years = [
    ...new Set([
      currentYear,
      currentYear - 1,
      ...Object.keys(data.byYear).map(Number).filter((n) => Number.isInteger(n)),
      year,
    ]),
  ].sort((a, b) => b - a);

  const canRefresh = configured && (await isAdminAuthenticated());

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <PageHeader
        eyebrow="Eventor"
        title="Årets topplistor"
        description="Klubbvisa rankingar från Eventor — skogskilometrar, formkurva, fältplacering och mer. Listorna cachas och uppdateras automatiskt om de är äldre än 14 dagar."
      />

      <p className="mt-4 text-sm text-slate-500">
        <Link href="/eventor" className="link-brand">
          ← Personlig Eventor-statistik
        </Link>
      </p>

      {!configured ? (
        <div className="mt-8 card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">Eventor är inte konfigurerat.</p>
          <p className="mt-2">
            Sätt <code className="rounded bg-amber-100 px-1">EVENTOR_API_KEY</code> i miljövariabler.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <EventorLeaderboardsPanel
            year={year}
            years={years}
            snapshot={snapshot}
            canRefresh={canRefresh}
            needsRefresh={needsRefresh}
          />
        </div>
      )}
    </main>
  );
}
