import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { MastarnasAdminPanel } from "@/components/MastarnasAdminPanel";
import { MastarnasStandingsTable } from "@/components/MastarnasStandingsTable";
import { PageHeader } from "@/components/PageHeader";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { readMastarnasData } from "@/lib/mastarnas";
import { formatPoints } from "@/lib/mastarnas-points";
import { computeStandings, getSeasonAwards, standingsForClass } from "@/lib/mastarnas-standings";

type Props = {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ klass?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  return { title: `Mästarnas Mästare ${year} — Resultatbanken` };
}

export default async function MastarnasYearPage({ params, searchParams }: Props) {
  const { year: yearParam } = await params;
  const { klass } = await searchParams;
  const year = Number(yearParam);
  const data = readMastarnasData();
  const season = data.seasons.find((item) => item.year === year);

  if (!season) {
    notFound();
  }

  const years = [...data.seasons.map((item) => item.year)].sort((a, b) => b - a);
  const allRows = computeStandings(data, season);
  const classId = klass && data.classes.some((item) => item.id === klass) ? klass : null;
  const rows = standingsForClass(allRows, classId);
  const awards = getSeasonAwards(data, year, allRows);
  const usedClasses = data.classes.filter((item) => allRows.some((row) => row.class_id === item.id) && item.id !== "okand");
  const canEdit = isAdminConfigured() && (await isAdminAuthenticated());
  const extraYouth = awards.overall && !awards.overall.is_youth ? awards.youth : null;
  const overallRepeat = awards.overall && awards.previousOverallKeys.includes(awards.overall.person_key);

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

      {awards.overall ? (
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
          href={`/mastarnas/${year}`}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            !classId ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          Sammanlagt
        </Link>
        {usedClasses.map((item) => (
          <Link
            key={item.id}
            href={`/mastarnas/${year}?klass=${item.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              classId === item.id ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      <MastarnasStandingsTable rows={rows} disciplines={data.disciplines} />

      {canEdit ? (
        <MastarnasAdminPanel
          year={year}
          classes={data.classes}
          disciplines={data.disciplines}
          events={season.events.map(({ id, discipline_id, name, date }) => ({
            id,
            discipline_id,
            name,
            date,
          }))}
        />
      ) : isAdminConfigured() ? (
        <details className="mt-12">
          <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-brand-700">
            Logga in för att registrera resultat
          </summary>
          <div className="mt-4">
            <AdminLoginForm />
          </div>
        </details>
      ) : null}
    </main>
  );
}
