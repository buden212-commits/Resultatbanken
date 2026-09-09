import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { MastarnasAdminPanel } from "@/components/MastarnasAdminPanel";
import { MastarnasEventResults } from "@/components/MastarnasEventResults";
import { MastarnasStandingsTable } from "@/components/MastarnasStandingsTable";
import { PageHeader } from "@/components/PageHeader";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { readMastarnasData } from "@/lib/mastarnas";
import { formatPoints } from "@/lib/mastarnas-points";
import { computeStandings, getSeasonAwards, standingsForClass, standingsForYouth } from "@/lib/mastarnas-standings";

type Props = {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ klass?: string; lista?: string; gren?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `Mästarnas Mästare ${year} — Resultatbanken` };
}

function yearHref(year: number, opts: { lista?: string; klass?: string; gren?: string } = {}) {
  const query = new URLSearchParams();
  if (opts.gren) {
    query.set("gren", opts.gren);
  }
  if (opts.lista) {
    query.set("lista", opts.lista);
  }
  if (opts.klass) {
    query.set("klass", opts.klass);
  }
  const encoded = query.toString();
  return encoded ? `/mastarnas/${year}?${encoded}` : `/mastarnas/${year}`;
}

export default async function MastarnasYearPage({ params, searchParams }: Props) {
  const { year: yearParam } = await params;
  const { klass, lista, gren } = await searchParams;
  const year = Number(yearParam);
  const data = readMastarnasData();
  const season = data.seasons.find((item) => item.year === year);

  if (!season) {
    notFound();
  }

  const years = [...data.seasons.map((item) => item.year)].sort((a, b) => b - a);
  const allRows = computeStandings(data, season);
  const classId = klass && data.classes.some((item) => item.id === klass) ? klass : null;
  const isYouthList = lista === "ungdom" && !classId;
  const selectedEvent = gren
    ? season.events.find((item) => item.discipline_id === gren) ??
      season.events.find((item) => item.id === gren)
    : undefined;
  const rows = isYouthList ? standingsForYouth(allRows) : standingsForClass(allRows, classId);
  const awards = getSeasonAwards(data, year, allRows);
  const usedClasses = data.classes.filter((item) => allRows.some((row) => row.class_id === item.id) && item.id !== "okand");
  const canEdit = isAdminConfigured() && (await isAdminAuthenticated());
  const extraYouth = awards.overall && !awards.overall.is_youth ? awards.youth : null;
  const overallRepeat = awards.overall && awards.previousOverallKeys.includes(awards.overall.person_key);
  const showAwards = !selectedEvent && !classId && !isYouthList;
  const eventChips = [...season.events].sort((a, b) => {
    const orderA = data.disciplines.find((item) => item.id === a.discipline_id)?.sort_order ?? 99;
    const orderB = data.disciplines.find((item) => item.id === b.discipline_id)?.sort_order ?? 99;
    return orderA - orderB || a.name.localeCompare(b.name, "sv");
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Klubbmästerskap"
        title={`Mästarnas Mästare ${year}`}
        description="Sex bästa resultaten räknas. Vid lika poäng avgör antal starter, därefter medel-KM."
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {years.map((item) => (
          <Link
            key={item}
            href={`/mastarnas/${item}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              item === year ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand-800"
            }`}
          >
            {item}
          </Link>
        ))}
      </div>

      {showAwards && awards.overall ? (
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <div className="card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Mästarnas Mästare</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{awards.overall.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {awards.overall.class_name} · {formatPoints(awards.overall.total)} p · {awards.overall.starts} starter
              {overallRepeat ? " · tavla redan utdelad tidigare år" : ""}
            </p>
          </div>
          {extraYouth ? (
            <div className="card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Bästa ungdom</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{extraYouth.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {extraYouth.class_name} · {formatPoints(extraYouth.total)} p · {extraYouth.starts} starter
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={yearHref(year)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            !classId && !isYouthList && !selectedEvent ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Sammanlagt
        </Link>
        <Link
          href={yearHref(year, { lista: "ungdom" })}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            isYouthList && !selectedEvent ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Ungdom
        </Link>
        {usedClasses.map((item) => (
          <Link
            key={item.id}
            href={yearHref(year, { klass: item.id })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              classId === item.id && !selectedEvent ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {eventChips.map((item) => {
          const disc = data.disciplines.find((discipline) => discipline.id === item.discipline_id);
          const label = disc?.name ?? item.name;
          const active = selectedEvent?.id === item.id;
          return (
            <Link
              key={item.id}
              href={yearHref(year, { gren: item.discipline_id, klass: classId ?? undefined })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
                active
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-600 ring-slate-200 hover:text-brand-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {selectedEvent ? (
        <MastarnasEventResults year={year} event={selectedEvent} classes={data.classes} canEdit={canEdit} />
      ) : (
        <MastarnasStandingsTable year={year} rows={rows} disciplines={data.disciplines} />
      )}

      {canEdit ? (
        <MastarnasAdminPanel
          year={year}
          classes={data.classes}
          disciplines={data.disciplines}
          initialEventId={selectedEvent?.id}
          initialClassId={classId ?? undefined}
          events={season.events.map(({ id, discipline_id, name, date }) => ({
            id,
            discipline_id,
            name,
            date,
          }))}
        />
      ) : isAdminConfigured() ? (
        <section id="redigera" className="mt-12 scroll-mt-24">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Redigera resultat</h2>
          <p className="mb-4 text-sm text-slate-600">Logga in för att lägga till eller ändra resultat, klasser och grenar.</p>
          <AdminLoginForm />
        </section>
      ) : null}
    </main>
  );
}
