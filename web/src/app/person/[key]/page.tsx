import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/PageHeader";
import { PersonResultsTable } from "@/components/PersonResultsTable";
import { StatCard } from "@/components/ui";
import { formatDate, getPerson } from "@/lib/data";

type Props = {
  params: Promise<{ key: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const person = getPerson(key);
  return {
    title: person ? `${person.display_name} — Resultatbanken` : "Person saknas",
  };
}

export default async function PersonPage({ params }: Props) {
  const { key } = await params;
  const person = getPerson(key);

  if (!person) {
    notFound();
  }

  const yearSpan =
    person.first_date && person.last_date
      ? `${person.first_date.slice(0, 4)}–${person.last_date.slice(0, 4)}`
      : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <BackLink href="/sok">Sök person</BackLink>

      <header className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Orienterare</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">{person.display_name}</h1>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <StatCard label="Antal resultat" value={person.result_count} />
        <StatCard label="Första resultat" value={person.first_date ? formatDate(person.first_date) : "–"} />
        <StatCard label="Senaste resultat" value={person.last_date ? formatDate(person.last_date) : "–"} />
      </div>

      {yearSpan ? (
        <p className="mt-4 text-sm text-slate-500">Aktiv {yearSpan}</p>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Resultathistorik</h2>
        <PersonResultsTable results={person.results} />
      </section>
    </main>
  );
}
