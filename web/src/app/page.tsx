import Link from "next/link";

import type { Metadata } from "next";

import { EventList } from "@/components/EventList";
import { PersonSearchForm } from "@/components/PersonSearchForm";
import {
  formatDuration,
  getEvents,
} from "@/lib/data";
import {
  getLongestTotalTimeInLastYear,
  getMostParticipationsInLastYear,
  getOverviewStats,
} from "@/lib/stats";

export const metadata: Metadata = {
  title: "Resultatbanken — IFK Mora OK",
  description: "Resultatarkiv för IFK Mora OK — träningar, KM och motionsorientering.",
};

export default function HomePage() {
  const events = getEvents();
  const overview = getOverviewStats();
  const peopleCount = overview.peopleCount;
  const resultsCount = overview.resultCount;
  const mostParticipations = getMostParticipationsInLastYear(1)[0];
  const longestTotalTime = getLongestTotalTimeInLastYear(1)[0];

  return (
    <main>
      <section className="hero-gradient px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="relative mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-200/90">
            IFK Mora OK
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Alla orienteringsresultat på ett ställe
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-50/90">
            Sök på namn, bläddra bland träningar och tävlingar — från 2004 till idag.
          </p>

          <div className="relative z-30 mt-8 max-w-2xl overflow-visible rounded-2xl bg-white/95 p-2 shadow-2xl shadow-black/20 backdrop-blur sm:p-3">
            <PersonSearchForm variant="hero" />
          </div>

          <div className="relative z-0 mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-2xl font-bold text-white">{events.length}</p>
              <p className="text-sm text-brand-100/80">Tävlingar & träningar</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-2xl font-bold text-white">{peopleCount}</p>
              <p className="text-sm text-brand-100/80">Unika personer</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-2xl font-bold text-white">{resultsCount.toLocaleString("sv-SE")}</p>
              <p className="text-sm text-brand-100/80">Registrerade starter</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-base font-bold leading-snug text-white sm:text-lg">
                {mostParticipations
                  ? `${mostParticipations.display_name} · ${mostParticipations.value}`
                  : "–"}
              </p>
              <p className="mt-1 text-sm text-brand-100/80">Flest träningar (senaste året)</p>
            </div>
            <div className="col-span-2 rounded-xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur sm:col-span-1">
              <p className="text-base font-bold leading-snug text-white sm:text-lg">
                {longestTotalTime
                  ? `${longestTotalTime.display_name} · ${formatDuration(longestTotalTime.value)}`
                  : "–"}
              </p>
              <p className="mt-1 text-sm text-brand-100/80">Längst tid totalt (senaste året)</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Senaste resultat</h2>
            <p className="mt-1 text-slate-500">Nyligen tillagda träningar och tävlingar</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/resultat" className="link-brand text-sm">
              Visa alla {events.length} →
            </Link>
            <Link href="/statistik" className="link-brand text-sm">
              Statistik →
            </Link>
          </div>
        </div>
        <EventList events={events.slice(0, 15)} />
      </section>
    </main>
  );
}
