import type { EventorPersonResult } from "./eventor-person";

export type EventorYearCount = { year: string; count: number };
export type EventorCountEntry = { label: string; count: number };

export type EventorPersonStats = {
  starts: number;
  finished: number;
  wins: number;
  podiums: number;
  dns: number;
  dnf: number;
  felst: number;
  dsq: number;
  bestPlace: number | null;
  avgPlace: number | null;
  totalTimeSeconds: number;
  avgKilometreTimeSeconds: number | null;
  bestKilometreTimeSeconds: number | null;
  bestKilometreTimeLabel: string | null;
  uniqueClasses: number;
  uniqueYears: number;
  resultsByYear: EventorYearCount[];
  topClasses: EventorCountEntry[];
  topDistances: EventorCountEntry[];
  topClassifications: EventorCountEntry[];
  years: number[];
};

function countMap(entries: string[]): EventorCountEntry[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (!entry) continue;
    map.set(entry, (map.get(entry) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "sv"));
}

export function filterResultsByYear(
  results: EventorPersonResult[],
  year: number | null,
): EventorPersonResult[] {
  if (!year) return results;
  const prefix = String(year);
  return results.filter((row) => row.date.startsWith(prefix));
}

export function buildEventorPersonStats(results: EventorPersonResult[]): EventorPersonStats {
  const finished = results.filter((row) => row.status === "ok");
  const places = finished
    .map((row) => row.place)
    .filter((place): place is number => place !== null && place > 0);
  const kmTimes = finished
    .map((row) => row.kilometreTimeSeconds)
    .filter((seconds): seconds is number => seconds !== null && seconds > 0);

  const yearCounts = new Map<string, number>();
  const years: number[] = [];
  let totalTimeSeconds = 0;

  for (const row of results) {
    if (row.date) {
      const year = row.date.slice(0, 4);
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
      const n = Number(year);
      if (Number.isInteger(n)) years.push(n);
    }
    if (row.status === "ok" && row.timeSeconds) {
      totalTimeSeconds += row.timeSeconds;
    }
  }

  const bestKm = kmTimes.length > 0 ? Math.min(...kmTimes) : null;
  const bestKmRow =
    bestKm === null
      ? null
      : finished.find((row) => row.kilometreTimeSeconds === bestKm) ?? null;

  return {
    starts: results.length,
    finished: finished.length,
    wins: finished.filter((row) => row.place === 1).length,
    podiums: finished.filter((row) => row.place !== null && row.place <= 3).length,
    dns: results.filter((row) => row.status === "dns").length,
    dnf: results.filter((row) => row.status === "dnf").length,
    felst: results.filter((row) => row.status === "felst").length,
    dsq: results.filter((row) => row.status === "dsq").length,
    bestPlace: places.length > 0 ? Math.min(...places) : null,
    avgPlace:
      places.length > 0
        ? Math.round((places.reduce((sum, place) => sum + place, 0) / places.length) * 10) / 10
        : null,
    totalTimeSeconds,
    avgKilometreTimeSeconds:
      kmTimes.length > 0
        ? Math.round(kmTimes.reduce((sum, seconds) => sum + seconds, 0) / kmTimes.length)
        : null,
    bestKilometreTimeSeconds: bestKm,
    bestKilometreTimeLabel: bestKmRow?.kilometreTime ?? null,
    uniqueClasses: new Set(results.map((row) => row.className).filter(Boolean)).size,
    uniqueYears: yearCounts.size,
    resultsByYear: [...yearCounts.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    topClasses: countMap(results.map((row) => row.className)).slice(0, 12),
    topDistances: countMap(
      results.map((row) => row.distanceKind).filter((value): value is string => Boolean(value)),
    ).slice(0, 8),
    topClassifications: countMap(results.map((row) => row.classification)).slice(0, 8),
    years: [...new Set(years)].sort((a, b) => b - a),
  };
}

export function formatKmPace(totalSeconds: number | null): string {
  if (totalSeconds === null || totalSeconds <= 0) return "–";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
