import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { StatsBarChart, StatsCountTable, StatsLeaderboard } from "@/components/StatsSections";
import { StatCard } from "@/components/ui";
import { getLastYearDateRange } from "@/lib/data";
import {
  getEventsByYear,
  getLeaderboardBestSingleYear,
  getLeaderboardLongestCareer,
  getLeaderboardLongestTotalTime,
  getLeaderboardMostEvents,
  getLeaderboardMostPodiums,
  getLeaderboardMostResults,
  getLeaderboardMostWins,
  getMostParticipationsInLastYear,
  getOverviewStats,
  getResultsByEventType,
  getResultsByLocation,
  getResultsByYear,
  getStatusBreakdown,
} from "@/lib/stats";

export const metadata: Metadata = {
  title: "Statistik — Resultatbanken",
  description: "Statistik och topplistor från IFK Mora OK:s resultatarkiv.",
};

export default function StatistikPage() {
  const overview = getOverviewStats();
  const lastYearRange = getLastYearDateRange();
  const resultsByYear = getResultsByYear();
  const recentYears = resultsByYear.filter((item) => item.year >= "2004");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Fas 2"
        title="Statistik"
        description="Aggregerad statistik från alla indexerade resultat. Personer med kopplade alias räknas ihop till ett namn. Vissa siffror påverkas av ofullständig parsing eller varierande klassnamn."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tävlingar & träningar" value={overview.eventCount} />
        <StatCard label="Unika personer" value={overview.peopleCount} />
        <StatCard label="Registrerade starter" value={overview.resultCount.toLocaleString("sv-SE")} />
        <StatCard
          label="Tidsperiod"
          value={
            overview.firstYear && overview.lastYear
              ? `${overview.firstYear}–${overview.lastYear}`
              : "–"
          }
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">Datatäckning</h2>
        <p className="mt-1 text-sm text-slate-500">
          {overview.eventsWithResults} av {overview.eventCount} event har parsade deltagare.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Med tid"
            value={`${overview.rowsWithTime} (${Math.round((overview.rowsWithTime / overview.resultCount) * 100)} %)`}
          />
          <StatCard
            label="Med placering"
            value={`${overview.rowsWithPlace} (${Math.round((overview.rowsWithPlace / overview.resultCount) * 100)} %)`}
          />
          <StatCard
            label="Med klass"
            value={`${overview.rowsWithClass} (${Math.round((overview.rowsWithClass / overview.resultCount) * 100)} %)`}
          />
          <StatCard
            label="Med klubb"
            value={`${overview.rowsWithClub} (${Math.round((overview.rowsWithClub / overview.resultCount) * 100)} %)`}
          />
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900">Starter per år</h2>
          <p className="mt-1 text-sm text-slate-500">Antal registrerade starter per kalenderår.</p>
          <div className="mt-5 max-h-[28rem] overflow-y-auto pr-1">
            <StatsBarChart items={recentYears.length > 0 ? recentYears : resultsByYear} />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900">Event per år</h2>
          <p className="mt-1 text-sm text-slate-500">Antal träningar och tävlingar i arkivet per år.</p>
          <div className="mt-5 max-h-[28rem] overflow-y-auto pr-1">
            <StatsBarChart
              items={getEventsByYear().filter((item) => item.year >= "2004")}
              valueLabel="event"
            />
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <StatsCountTable title="Starter per typ" items={getResultsByEventType()} labelHeader="Typ" />
        <StatsCountTable title="Starter per plats" items={getResultsByLocation()} labelHeader="Plats" />
      </section>

      <section className="mt-10">
        <StatsCountTable title="Statusfördelning" items={getStatusBreakdown()} labelHeader="Status" />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">Topplistor — genom tiderna</h2>
        <p className="mt-1 text-sm text-slate-500">
          Personer med kopplade alias räknas ihop. Klicka på ett namn för personsidan.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatsLeaderboard
            title="Flest event"
            subtitle="Unika träningar/tävlingar"
            entries={getLeaderboardMostEvents(10)}
          />
          <StatsLeaderboard
            title="Flest starter"
            subtitle="Totalt antal rader i index"
            entries={getLeaderboardMostResults(10)}
          />
          <StatsLeaderboard title="Flest segrar" entries={getLeaderboardMostWins(10)} />
          <StatsLeaderboard title="Flest pallplatser" subtitle="Plats 1–3" entries={getLeaderboardMostPodiums(10)} />
          <StatsLeaderboard
            title="Längst total tid"
            subtitle="Summan av alla tider"
            entries={getLeaderboardLongestTotalTime(10)}
            valueKind="duration"
          />
          <StatsLeaderboard
            title="Längst karriär"
            subtitle="Antal år mellan första och senaste resultat"
            entries={getLeaderboardLongestCareer(10)}
            valueKind="years"
          />
          <StatsLeaderboard
            title="Mest aktivt år"
            subtitle="Flest starter under ett kalenderår"
            entries={getLeaderboardBestSingleYear(10)}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">
          Topplistor — senaste året ({lastYearRange.from.slice(0, 4)}–{lastYearRange.to.slice(0, 4)})
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatsLeaderboard
            title="Flest träningar"
            entries={getMostParticipationsInLastYear(10)}
          />
          <StatsLeaderboard
            title="Flest starter"
            entries={getLeaderboardMostResults(10, lastYearRange)}
          />
          <StatsLeaderboard title="Flest segrar" entries={getLeaderboardMostWins(10, lastYearRange)} />
          <StatsLeaderboard
            title="Längst total tid"
            entries={getLeaderboardLongestTotalTime(10, lastYearRange)}
            valueKind="duration"
          />
        </div>
      </section>

      <section className="mt-10 card border-brand-100 bg-brand-50/50 p-5">
        <h2 className="text-base font-semibold text-slate-900">Om siffrorna</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>Personliga rekord och detaljerad historik finns på respektive personsida.</li>
          <li>Klassnamn varierar i källfilerna — PR per klass kan dupliceras för liknande banor.</li>
          <li>Äldre PDF:er och skannade ark kan sakna namn eller tider.</li>
          <li>
            Koppla ihop stavningar under{" "}
            <Link href="/koppla-namn" className="link-brand">
              Koppla namn
            </Link>{" "}
            för bättre personstatistik.
          </li>
        </ul>
      </section>
    </main>
  );
}
