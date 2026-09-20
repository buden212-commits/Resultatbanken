import Link from "next/link";

import { StatsBarChart, StatsCountTable } from "@/components/StatsCharts";
import { formatPoints } from "@/lib/mastarnas-points";
import type { CloseTitleRace } from "@/lib/mastarnas-stats";
import { formatMargin } from "@/lib/mastarnas-stats";
import type { LeaderboardEntry } from "@/lib/stats";

export { StatsBarChart, StatsCountTable };

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

export function StatsCloseRaces({ races }: { races: CloseTitleRace[] }) {
  if (races.length === 0) {
    return null;
  }

  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-base font-semibold text-slate-900">Tätaste kupperna</h3>
      <p className="mt-1 text-sm text-slate-500">
        Minsta avståndet mellan ettan och tvåan, räknat på de sex bästa.
      </p>
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
