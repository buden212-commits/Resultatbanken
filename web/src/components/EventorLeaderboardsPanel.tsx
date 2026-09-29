"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { buildEventorLeaderboardSnapshot } from "@/lib/eventor-leaderboard-stats";
import type {
  EventorLeaderboardBoard,
  EventorLeaderboardSnapshot,
  EventorLeaderboardValueKind,
} from "@/lib/eventor-leaderboard-types";
import { formatKmPace } from "@/lib/eventor-person-stats";
import {
  DEFAULT_EVENTOR_SPORT_FILTER,
  type EventorSportFilter,
} from "@/lib/eventor-sport";

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "–";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatValue(value: number, kind: EventorLeaderboardValueKind): string {
  switch (kind) {
    case "duration":
      return formatDuration(value);
    case "pace":
      return `${formatKmPace(Math.round(value))}/km`;
    case "km":
      return `${value.toLocaleString("sv-SE", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      })} km`;
    case "percent":
      return `${(value * 100).toLocaleString("sv-SE", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      })} %`;
    case "ratio":
      return value.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
    default:
      return value.toLocaleString("sv-SE");
  }
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BoardCard({ board, year }: { board: EventorLeaderboardBoard; year: number }) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-base font-semibold text-slate-900">{board.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{board.subtitle}</p>
      {board.entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Ingen data ännu.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {board.entries.map((entry, index) => (
            <li key={`${board.id}-${entry.personId}`}>
              <Link
                href={`/eventor?personId=${encodeURIComponent(entry.personId)}&year=${year}`}
                className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 transition hover:bg-brand-50 sm:px-2"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-slate-800">{entry.displayName}</span>
                </span>
                <span className="min-w-0 max-w-[42%] shrink-0 text-right">
                  <span className="font-semibold tabular-nums text-brand-700">
                    {formatValue(entry.value, board.valueKind)}
                  </span>
                  {entry.detail ? (
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

export function EventorLeaderboardsPanel({
  year,
  years,
  snapshot,
  canRefresh,
}: {
  year: number;
  years: number[];
  snapshot: EventorLeaderboardSnapshot | null;
  canRefresh: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<EventorSportFilter>(DEFAULT_EVENTOR_SPORT_FILTER);

  const canRefilter = Boolean(snapshot?.rows && snapshot.rows.length > 0);

  const view = useMemo(() => {
    if (!snapshot) return null;
    if (!canRefilter) return snapshot;
    return buildEventorLeaderboardSnapshot(
      snapshot.year,
      snapshot.rows ?? [],
      {
        eventsScanned: snapshot.eventsScanned,
        importedAt: snapshot.importedAt,
      },
      sportFilter,
    );
  }, [snapshot, sportFilter, canRefilter]);

  async function onRefresh() {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/eventor-leaderboards/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const json = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(json.error || "Uppdatering misslyckades.");
      }
      setMessage(json.message ?? "Topplistor uppdaterade.");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uppdatering misslyckades.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className={`space-y-8 ${pending ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {view
              ? `Uppdaterad ${formatUpdatedAt(view.importedAt)} · ${view.personCount} löpare · ${view.resultCount} resultat · ${view.eventsScanned} tävlingar`
              : "Ingen snapshot för valt år ännu."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-slate-600" htmlFor="eventor-lb-year">
            År
          </label>
          <select
            id="eventor-lb-year"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={year}
            onChange={(event) => {
              const next = Number(event.target.value);
              startTransition(() => {
                router.push(`/eventor/topplistor?year=${next}`);
              });
            }}
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {canRefresh ? (
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={refreshing}
              className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {refreshing ? "Hämtar från Eventor…" : `Uppdatera ${year}`}
            </button>
          ) : null}
        </div>
      </div>

      {snapshot ? (
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
          <span className="font-medium text-slate-600">Visa:</span>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={sportFilter.excludeMtbo}
              disabled={!canRefilter}
              onChange={(event) =>
                setSportFilter((prev) => ({ ...prev, excludeMtbo: event.target.checked }))
              }
            />
            Exkludera MTBO
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={sportFilter.excludeSkio}
              disabled={!canRefilter}
              onChange={(event) =>
                setSportFilter((prev) => ({ ...prev, excludeSkio: event.target.checked }))
              }
            />
            Exkludera SkidO
          </label>
          {!canRefilter ? (
            <span className="text-xs text-slate-500">
              Uppdatera topplistorna för att aktivera filter.
            </span>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!view ? (
        <div className="card px-6 py-10 text-center text-slate-500">
          {canRefresh
            ? `Klicka på “Uppdatera ${year}” för att hämta årets klubbresultat från Eventor.`
            : `Topplistorna för ${year} har inte genererats ännu.`}
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Ovanliga topplistor</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {view.featured.map((board) => (
                <BoardCard key={board.id} board={board} year={year} />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Klassiska listor</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {view.classic.map((board) => (
                <BoardCard key={board.id} board={board} year={year} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
