import Link from "next/link";

import { StatsBarChart, StatsCloseRaces, StatsCountTable, StatsLeaderboard } from "@/components/StatsSections";
import { StatCard } from "@/components/ui";
import { getMastarnasCupStats } from "@/lib/mastarnas-stats";

export function MastarnasStatsSection() {
  const stats = getMastarnasCupStats();
  if (stats.overview.seasonCount === 0) {
    return null;
  }

  const period =
    stats.overview.firstYear && stats.overview.lastYear
      ? `${stats.overview.firstYear}–${stats.overview.lastYear}`
      : "–";

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Mästarnas Mästare</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cupen genom tiderna. Sex bästa grenarna räknas. Titlar kräver minst sex genomförda grenar den säsongen.
          </p>
        </div>
        <Link href="/mastarnas" className="text-sm font-medium text-brand-700 hover:text-brand-900">
          Öppna cupen
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Säsonger" value={stats.overview.seasonCount} subtitle={period} />
        <StatCard label="Deltagare" value={stats.overview.peopleCount.toLocaleString("sv-SE")} />
        <StatCard label="KM-starter" value={stats.overview.startCount.toLocaleString("sv-SE")} />
        <StatCard label="Grenar med resultat" value={stats.overview.eventCount.toLocaleString("sv-SE")} />
      </div>

      {stats.funFacts.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {stats.funFacts.map((fact) => (
            <Link key={fact.href + fact.eyebrow} href={fact.href} className="card-hover card block px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{fact.eyebrow}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{fact.title}</p>
              <p className="mt-1 text-sm text-slate-500">{fact.detail}</p>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-base font-semibold text-slate-900">Deltagare per år</h3>
          <p className="mt-1 text-sm text-slate-500">Unika namn i cupen varje säsong.</p>
          <div className="mt-5 max-h-[28rem] overflow-y-auto pr-1">
            <StatsBarChart items={stats.participantsByYear} valueLabel="personer" />
          </div>
        </div>
        <StatsCountTable title="Starter per gren" items={stats.startsByDiscipline} labelHeader="Gren" />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <StatsLeaderboard
          title="Flest titlar"
          subtitle="Mästarnas Mästare, delad titel räknas"
          entries={stats.titles}
        />
        <StatsLeaderboard title="Flest ungdomstitlar" subtitle="Bästa ungdom varje säsong" entries={stats.youthTitles} />
        <StatsLeaderboard
          title="Flest 24-poängare"
          subtitle="Vinst i klass med tre eller fler startande"
          entries={stats.perfectScores}
        />
        <StatsLeaderboard title="Flest klassvinster" subtitle="Högst poäng i klassen den grenen" entries={stats.classWins} />
        <StatsLeaderboard title="Flest starter" subtitle="Alla KM i cupen" entries={stats.mostStarts} />
        <StatsLeaderboard
          title="Flest säsonger"
          subtitle="Antal säsonger i cupen"
          entries={stats.mostSeasons}
          valueKind="years"
        />
        <StatsLeaderboard
          title="Mest komplett år"
          subtitle="Flest grenar under en säsong"
          entries={stats.completeYears}
        />
        <StatsLeaderboard
          title="Högsta säsongspoäng"
          subtitle="Sex bästa grenarna"
          entries={stats.highestSeasons}
          valueKind="points"
        />
        <StatsCloseRaces races={stats.closeRaces} />
      </div>
    </section>
  );
}
