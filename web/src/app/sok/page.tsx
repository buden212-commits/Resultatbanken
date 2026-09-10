import type { Metadata } from "next";
import Link from "next/link";

import { EventList, PersonResultList } from "@/components/EventList";
import { PageHeader } from "@/components/PageHeader";
import { PersonSearchForm } from "@/components/PersonSearchForm";
import { getEvents, searchPeople } from "@/lib/data";
import { searchEvents } from "@/lib/event-search";

export const metadata: Metadata = {
  title: "Sök — Resultatbanken",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const people = searchPeople(q);
  const events = q.trim() ? searchEvents(getEvents(), q) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <PageHeader
        eyebrow="Sök"
        title="Hitta i arkivet"
        description="Sök på namn, tävling, plats eller år bland orienterare och resultat."
      />

      <div className="card relative z-30 max-w-2xl overflow-visible p-4 sm:p-5">
        <PersonSearchForm initialQuery={q} />
      </div>

      {q ? (
        <div className="mt-10 space-y-10">
          {people.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-900">Personer</h2>
              <p className="mb-4 text-sm font-medium text-slate-500">
                {`${people.length} ${people.length === 1 ? "träff" : "träffar"} för “${q}”`}
              </p>
              <PersonResultList people={people} />
            </section>
          ) : null}

          {events.length > 0 ? (
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Tävlingar & träningar</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {`${events.length} ${events.length === 1 ? "träff" : "träffar"} för “${q}”`}
                  </p>
                </div>
                <Link href={`/resultat?q=${encodeURIComponent(q)}`} className="link-brand text-sm">
                  Visa i arkivet →
                </Link>
              </div>
              <EventList events={events.slice(0, 20)} />
              {events.length > 20 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Visar 20 av {events.length}.{" "}
                  <Link href={`/resultat?q=${encodeURIComponent(q)}`} className="link-brand">
                    Se alla träffar
                  </Link>
                </p>
              ) : null}
            </section>
          ) : null}

          {people.length === 0 && events.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <p className="text-lg font-medium text-slate-700">Inget hittades</p>
              <p className="mt-2 text-sm text-slate-500">
                Prova ett namn, årtal, KM, plats eller en del av tävlingsnamnet.
              </p>
              <Link href="/resultat" className="link-brand mt-4 inline-block text-sm">
                Bläddra alla resultat istället
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-10 card px-6 py-10 text-center text-slate-500">
          <p>Sök på namn, tävling, plats eller år, till exempel medel 2013.</p>
        </div>
      )}
    </main>
  );
}
