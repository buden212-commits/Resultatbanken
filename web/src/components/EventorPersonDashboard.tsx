"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { StatsBarChart, StatsCountTable } from "@/components/StatsCharts";
import { StatCard } from "@/components/ui";
import type { EventorClubPerson, EventorPersonResult } from "@/lib/eventor-person";
import type { EventorPersonStats } from "@/lib/eventor-person-stats";
import { formatKmPace } from "@/lib/eventor-person-stats";

type DashboardPayload = {
  person: EventorClubPerson;
  year: number | null;
  years: number[];
  stats: EventorPersonStats;
  results: EventorPersonResult[];
  totalResults: number;
};

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "–";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "–";
  const [y, m, d] = date.split("-");
  return `${Number(d)}/${Number(m)} ${y}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "ok":
      return "OK";
    case "dns":
      return "DNS";
    case "dnf":
      return "DNF";
    case "felst":
      return "Felst.";
    case "dsq":
      return "DSQ";
    default:
      return status;
  }
}

export function EventorPersonDashboard({
  initialQuery = "",
  initialPersonId,
  initialYear,
}: {
  initialQuery?: string;
  initialPersonId?: string;
  initialYear?: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<EventorClubPerson[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPerson, setLoadingPerson] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/eventor/persons?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json = (await response.json()) as { persons?: EventorClubPerson[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error || "Sökning misslyckades.");
        }
        setHits(json.persons ?? []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setHits([]);
        setSearchError(error instanceof Error ? error.message : "Sökning misslyckades.");
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  async function loadPerson(personId: string, year?: number | null) {
    setLoadingPerson(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (year) params.set("year", String(year));
      const response = await fetch(
        `/api/eventor/persons/${encodeURIComponent(personId)}${params.size ? `?${params}` : ""}`,
      );
      const json = (await response.json()) as DashboardPayload & { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Kunde inte hämta statistik.");
      }
      setData(json);
      setQuery(json.person.displayName);
      setHits([]);
      const next = new URLSearchParams();
      next.set("personId", personId);
      if (year) next.set("year", String(year));
      startTransition(() => {
        router.replace(`/eventor?${next.toString()}`);
      });
    } catch (error) {
      setData(null);
      setLoadError(error instanceof Error ? error.message : "Kunde inte hämta statistik.");
    } finally {
      setLoadingPerson(false);
    }
  }

  useEffect(() => {
    if (initialPersonId) {
      void loadPerson(initialPersonId, initialYear ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once from URL
  }, [initialPersonId]);

  const yearOptions = useMemo(() => data?.years ?? [], [data]);

  return (
    <div className="space-y-8">
      <div className="card relative z-20 max-w-2xl overflow-visible p-4 sm:p-5">
        <label className="block text-sm font-medium text-slate-700" htmlFor="eventor-person-q">
          Sök klubbmedlem i Eventor
        </label>
        <input
          id="eventor-person-q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="t.ex. Jonas Buud"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-brand-500/30 focus:ring-2"
          autoComplete="off"
        />
        <p className="mt-2 text-xs text-slate-500">
          Hämtar live från Eventor för IFK Mora OK. Årsfilter tillämpas efter att personen valts.
        </p>

        {searching ? <p className="mt-3 text-sm text-slate-500">Söker…</p> : null}
        {searchError ? <p className="mt-3 text-sm text-red-600">{searchError}</p> : null}

        {hits.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
            {hits.map((person) => (
              <li key={person.personId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-brand-50"
                  onClick={() => void loadPerson(person.personId, null)}
                >
                  <span className="font-medium text-slate-800">{person.displayName}</span>
                  <span className="text-xs tabular-nums text-slate-400">#{person.personId}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {loadingPerson ? (
        <div className="card px-6 py-10 text-center text-slate-500">Hämtar resultat från Eventor…</div>
      ) : null}
      {loadError ? (
        <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{loadError}</div>
      ) : null}

      {data ? (
        <div className={`space-y-8 ${pending ? "opacity-80" : ""}`}>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Eventor</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {data.person.displayName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {data.year ? `År ${data.year}` : "Alla år"} · {data.stats.starts} starter
                {data.year && data.totalResults !== data.stats.starts
                  ? ` (${data.totalResults} totalt)`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-slate-600" htmlFor="eventor-year">
                År
              </label>
              <select
                id="eventor-year"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={data.year ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  void loadPerson(data.person.personId, value ? Number(value) : null);
                }}
              >
                <option value="">Alla år</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Starter" value={data.stats.starts} />
            <StatCard label="Fullföljda" value={data.stats.finished} />
            <StatCard label="Segrar" value={data.stats.wins} />
            <StatCard label="Pallplatser" value={data.stats.podiums} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Bästa placering"
              value={data.stats.bestPlace !== null ? `${data.stats.bestPlace}:a` : "–"}
            />
            <StatCard
              label="Snittplacering"
              value={data.stats.avgPlace !== null ? data.stats.avgPlace.toLocaleString("sv-SE") : "–"}
            />
            <StatCard label="Total tid" value={formatDuration(data.stats.totalTimeSeconds)} />
            <StatCard
              label={
                data.stats.avgKilometreTimeSeconds
                  ? `Bästa km-tid · snitt ${formatKmPace(data.stats.avgKilometreTimeSeconds)}`
                  : "Bästa km-tid"
              }
              value={data.stats.bestKilometreTimeLabel ?? formatKmPace(data.stats.bestKilometreTimeSeconds)}
            />
          </div>

          {(data.stats.dns > 0 || data.stats.dnf > 0 || data.stats.felst > 0 || data.stats.dsq > 0) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.stats.dns > 0 ? <StatCard label="DNS" value={data.stats.dns} /> : null}
              {data.stats.dnf > 0 ? <StatCard label="DNF" value={data.stats.dnf} /> : null}
              {data.stats.felst > 0 ? <StatCard label="Felstämplat" value={data.stats.felst} /> : null}
              {data.stats.dsq > 0 ? <StatCard label="Diskad" value={data.stats.dsq} /> : null}
            </div>
          )}

          {data.stats.resultsByYear.length > 1 && !data.year ? (
            <section>
              <h3 className="mb-4 text-lg font-bold text-slate-900">Starter per år</h3>
              <div className="card p-5">
                <StatsBarChart items={data.stats.resultsByYear} />
              </div>
            </section>
          ) : null}

          {(data.stats.topClasses.length > 0 ||
            data.stats.topDistances.length > 0 ||
            data.stats.topClassifications.length > 0) && (
            <section className="grid gap-6 lg:grid-cols-3">
              {data.stats.topClasses.length > 0 ? (
                <StatsCountTable title="Klasser" items={data.stats.topClasses} labelHeader="Klass" />
              ) : null}
              {data.stats.topDistances.length > 0 ? (
                <StatsCountTable
                  title="Banor / distanser"
                  items={data.stats.topDistances}
                  labelHeader="Distans"
                />
              ) : null}
              {data.stats.topClassifications.length > 0 ? (
                <StatsCountTable
                  title="Tävlingstyper"
                  items={data.stats.topClassifications}
                  labelHeader="Typ"
                />
              ) : null}
            </section>
          )}

          <section>
            <h3 className="mb-4 text-lg font-bold text-slate-900">Resultathistorik</h3>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/80">
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-3 sm:px-4">Datum</th>
                      <th className="px-3 py-3 sm:px-4">Tävling</th>
                      <th className="px-3 py-3 sm:px-4">Klass</th>
                      <th className="px-3 py-3 sm:px-4">Plac.</th>
                      <th className="px-3 py-3 sm:px-4">Tid</th>
                      <th className="px-3 py-3 sm:px-4">Km-tid</th>
                      <th className="px-3 py-3 sm:px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((row) => (
                      <tr
                        key={`${row.eventId}-${row.className}-${row.time ?? row.status}-${row.isTeam}`}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600 sm:px-4">
                          {formatDate(row.date)}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4">
                          <a
                            href={row.eventUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="link-brand font-medium"
                          >
                            {row.eventName}
                          </a>
                          <div className="text-xs text-slate-400">
                            {row.classification}
                            {row.distanceKind ? ` · ${row.distanceKind}` : ""}
                            {row.isTeam ? " · stafett" : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 sm:px-4">{row.className}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">
                          {row.place !== null ? row.place : "–"}
                          {row.startsInClass ? (
                            <span className="text-slate-400">/{row.startsInClass}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">
                          {row.time ?? "–"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">
                          {row.kilometreTime ?? "–"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 sm:px-4">{statusLabel(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.results.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">Inga resultat för valt år.</p>
              ) : null}
            </div>
          </section>

          <p className="text-sm text-slate-500">
            Vill du jämföra med Mora-arkivet?{" "}
            <Link href="/sok" className="link-brand">
              Sök i Resultatbanken
            </Link>
          </p>
        </div>
      ) : !loadingPerson && !initialPersonId ? (
        <div className="card px-6 py-10 text-center text-slate-500">
          Sök och välj en person — prova <button type="button" className="link-brand" onClick={() => setQuery("Jonas Buud")}>Jonas Buud</button>.
        </div>
      ) : null}
    </div>
  );
}
