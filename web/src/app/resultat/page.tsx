import type { Metadata } from "next";
import Link from "next/link";

import { EventList } from "@/components/EventList";
import { EventSearchForm } from "@/components/EventSearchForm";
import { PageHeader } from "@/components/PageHeader";
import { getEventIdsWithUnreasonableTimes, getEvents } from "@/lib/data";
import { searchEvents } from "@/lib/event-search";

export const metadata: Metadata = {
  title: "Alla resultat — Resultatbanken",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ResultsPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const allEvents = getEvents();
  const events = searchEvents(allEvents, q);
  const eventIdsWithUnreasonableTimes = getEventIdsWithUnreasonableTimes();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Arkiv"
        title="Alla resultat"
        description={`${allEvents.length} träningar och tävlingar — sök på namn, KM, plats eller år.`}
      />

      <div className="card mb-8 max-w-2xl p-4 sm:p-5">
        <EventSearchForm initialQuery={q} />
      </div>

      {q ? (
        <p className="mb-4 text-sm font-medium text-slate-500">
          {events.length} träff{events.length === 1 ? "" : "ar"} för &quot;{q}&quot;
        </p>
      ) : null}

      {events.length > 0 ? (
        <EventList events={events} eventIdsWithUnreasonableTimes={eventIdsWithUnreasonableTimes} />
      ) : (
        <div className="card px-6 py-12 text-center">
          <p className="text-lg font-medium text-slate-700">Inget resultat hittades</p>
          <p className="mt-2 text-sm text-slate-500">Prova årtal, KM, plats eller en del av namnet.</p>
          <Link href="/resultat" className="link-brand mt-4 inline-block text-sm">
            Visa alla resultat
          </Link>
        </div>
      )}
    </main>
  );
}
