import Link from "next/link";

import { formatPoints } from "@/lib/mastarnas-points";
import type { CloseTitleRace } from "@/lib/mastarnas-stats";
import { formatMargin } from "@/lib/mastarnas-stats";
import type { CountEntry, LeaderboardEntry, YearCount } from "@/lib/stats";

export function StatsBarChart({
  items,
  valueLabel = "starter",
}: {
  items: YearCount[] | CountEntry[];
  valueLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Ingen data att visa.</p>;
  }

  const max = Math.max(...items.map((item) => item.count));
  const isYearSeries = "year" in items[0];

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const label = isYearSeries ? (item as YearCount).year : (item as CountEntry).label;
        const width = max > 0 ? Math.max(4, Math.round((item.count / max) * 100)) : 0;
        return (
          <div key={label} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 text-sm sm:grid-cols-[4.5rem_1fr_auto] sm:gap-3">
            <span className="font-medium text-slate-600">{label}</span>
            <div className="h-3 min-w-0 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="whitespace-nowrap tabular-nums text-slate-500">
              {item.count.toLocaleString("sv-SE")}
              <span className="hidden sm:inline"> {valueLabel}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsLeaderboard({
  title,
  subtitle,
  entries,
  valueKind = "count",
  emptyMessage = "Ingen data.",
}: {
  title: string;
  subtitle?: string;
  entries: LeaderboardEntry[];
  valueKind?: "count" | "duration" | "years" | "points";
  emptyMessage?: string;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {entries.map((entry, index) => (
            <li key={entry.person_key}>
              <Link
                href={`/person/${encodeURIComponent(entry.person_key)}`}
                className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 sm:px-2 transition hover:bg-brand-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-slate-800">{entry.display_name}</span>
                </span>
                <span className="min-w-0 max-w-[42%] shrink-0 text-right">
                  <span className="font-semibold tabular-nums text-brand-700">
                    {valueKind === "duration"
                      ? (entry.detail ?? `${entry.value}`)
                      : valueKind === "years"
                        ? `${entry.value} år`
                        : valueKind === "points"
                          ? formatPoints(entry.value)
                          : entry.value.toLocaleString("sv-SE")}
                  </span>
                  {entry.detail && valueKind !== "duration" ? (
                    <span className="block text-xs leading-snug text-slate-500">{entry.detail}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function StatsCountTable({
  title,
  items,
  labelHeader = "Namn",
}: {
  title: string;
  items: CountEntry[];
  labelHeader?: string;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Ingen data.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-4">{labelHeader}</th>
                <th className="py-2 text-right">Antal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.label} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pr-4 font-medium text-slate-800">{item.label}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">
                    {item.count.toLocaleString("sv-SE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function StatsCloseRaces({ races }: { races: CloseTitleRace[] }) {
  if (races.length === 0) {
    return null;
  }

  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-base font-semibold text-slate-900">Tätaste kupperna</h3>
      <p className="mt-1 text-sm text-slate-500">Minsta avståndet mellan ettan och tvåan, räknat på de sex bästa.</p>
      <ol className="mt-4 space-y-3">
        {races.map((race) => (
          <li key={race.year}>
            <Link
              href={`/mastarnas/${race.year}`}
              className="flex items-start justify-between gap-3 rounded-lg px-1 py-2 sm:px-2 transition hover:bg-brand-50"
            >
              <span className="min-w-0">
                <span className="font-semibold text-slate-800">{race.year}</span>
                <span className="mt-0.5 block text-sm text-slate-600">
                  {race.leaders.map((row) => row.display_name).join(" & ")}
                  {race.chasers[0] ? ` före ${race.chasers[0].display_name}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right font-semibold tabular-nums text-brand-700">
                {formatMargin(race.margin)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
