import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/PageHeader";
import { PersonResultsTable } from "@/components/PersonResultsTable";
import { StatsBarChart, StatsCountTable } from "@/components/StatsSections";
import { StatCard } from "@/components/ui";
import { formatDate, formatDuration, getPerson } from "@/lib/data";
import { resolvePersonKey } from "@/lib/person-aliases";
import { getPersonStats } from "@/lib/stats";

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
  const canonicalKey = resolvePersonKey(key);
  if (canonicalKey !== key) {
    redirect(`/person/${encodeURIComponent(canonicalKey)}`);
  }

  const person = getPerson(key);

  if (!person) {
    notFound();
  }

  const stats = getPersonStats(person);

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

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Antal resultat" value={person.result_count} />
        <StatCard label="Unika event" value={stats.uniqueEvents} />
        <StatCard label="Segrar" value={stats.wins} />
        <StatCard label="Pallplatser" value={stats.podiums} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Första resultat" value={person.first_date ? formatDate(person.first_date) : "–"} />
        <StatCard label="Senaste resultat" value={person.last_date ? formatDate(person.last_date) : "–"} />
        <StatCard
          label="Total orienteringstid"
          value={stats.totalTimeSeconds > 0 ? formatDuration(stats.totalTimeSeconds) : "–"}
        />
        <StatCard
          label="Bästa placering"
          value={stats.bestPlace !== null ? `${stats.bestPlace}:a` : "–"}
        />
      </div>

      {(stats.dns > 0 || stats.dnf > 0 || stats.felst > 0 || stats.deltagit > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.deltagit > 0 ? <StatCard label="Deltagit (utan tid)" value={stats.deltagit} /> : null}
          {stats.dns > 0 ? <StatCard label="DNS" value={stats.dns} /> : null}
          {stats.dnf > 0 ? <StatCard label="DNF" value={stats.dnf} /> : null}
          {stats.felst > 0 ? <StatCard label="Felstämplat" value={stats.felst} /> : null}
        </div>
      )}

      {yearSpan ? (
        <p className="mt-4 text-sm text-slate-500">
          Aktiv {yearSpan}
          {stats.uniqueYears > 0 ? ` · ${stats.uniqueYears} kalenderår` : ""}
          {stats.longestStreakYears > 1 ? ` · ${stats.longestStreakYears} år i rad` : ""}
        </p>
      ) : null}

      {stats.resultsByYear.length > 1 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Starter per år</h2>
          <div className="card p-5">
            <StatsBarChart items={stats.resultsByYear} />
          </div>
        </section>
      ) : null}

      {stats.personalRecords.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Personliga rekord per klass</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Klass</th>
                    <th className="px-4 py-3">Bästa tid</th>
                    <th className="px-4 py-3">Placering</th>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Event</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.personalRecords.map((record) => (
                    <tr key={record.class_name} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-800">{record.class_name}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{record.time}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {record.place !== null ? `${record.place}:a` : "–"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {record.date ? formatDate(record.date) : "–"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{record.event_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {(stats.topLocations.length > 0 || stats.topEventTypes.length > 0) && (
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          {stats.topLocations.length > 0 ? (
            <StatsCountTable title="Vanligaste platser" items={stats.topLocations} labelHeader="Plats" />
          ) : null}
          {stats.topEventTypes.length > 0 ? (
            <StatsCountTable title="Vanligaste typer" items={stats.topEventTypes} labelHeader="Typ" />
          ) : null}
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Resultathistorik</h2>
        <PersonResultsTable results={person.results} />
      </section>
    </main>
  );
}
