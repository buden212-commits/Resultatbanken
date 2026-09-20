import type { Metadata } from "next";

import { EventorPersonDashboard } from "@/components/EventorPersonDashboard";
import { PageHeader } from "@/components/PageHeader";
import { isEventorConfigured } from "@/lib/eventor";

export const metadata: Metadata = {
  title: "Eventor-statistik — Resultatbanken",
  description: "Personlig statistik från Eventor för IFK Mora OK-medlemmar.",
};

type Props = {
  searchParams: Promise<{ personId?: string; year?: string; q?: string }>;
};

export default async function EventorStatsPage({ searchParams }: Props) {
  const { personId, year, q } = await searchParams;
  const configured = isEventorConfigured();
  const yearNum = year ? Number(year) : undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <PageHeader
        eyebrow="Eventor"
        title="Personlig statistik"
        description="Sök en klubbmedlem och se starter, placeringar, klasser och km-tider direkt från Eventor. Filtrera per år."
      />

      {!configured ? (
        <div className="mt-8 card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">Eventor är inte konfigurerat.</p>
          <p className="mt-2">
            Sätt <code className="rounded bg-amber-100 px-1">EVENTOR_API_KEY</code> i miljövariabler för
            att hämta personstatistik.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <EventorPersonDashboard
            initialQuery={q ?? ""}
            initialPersonId={personId}
            initialYear={Number.isInteger(yearNum) ? yearNum : undefined}
          />
        </div>
      )}
    </main>
  );
}
