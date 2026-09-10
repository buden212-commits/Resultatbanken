import { formatPoints, resultPoints } from "./mastarnas-points";
import { readMastarnasData } from "./mastarnas";
import { computeStandings, getSeasonAwards } from "./mastarnas-standings";
import { resolveDisplayName, resolvePersonKey } from "./person-aliases";
import type { CountEntry, LeaderboardEntry, YearCount } from "./stats";
import type { MastarnasData, MastarnasSeason } from "./mastarnas-types";

export type MastarnasOverviewStats = {
  seasonCount: number;
  firstYear: number | null;
  lastYear: number | null;
  peopleCount: number;
  startCount: number;
  eventCount: number;
};

export type CloseTitleRace = {
  year: number;
  margin: number;
  leaders: { person_key: string; display_name: string; total: number }[];
  chasers: { person_key: string; display_name: string; total: number }[];
};

export type MastarnasFunFact = {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
};

type Acc = { name: string; value: number; years: number[] };

const MIN_EVENTS_FOR_TITLES = 6;

const globalForStats = globalThis as typeof globalThis & {
  __rbMastarnasStats?: WeakMap<MastarnasData, ComputedStats>;
};

type ComputedStats = {
  overview: MastarnasOverviewStats;
  participantsByYear: YearCount[];
  startsByDiscipline: CountEntry[];
  titles: LeaderboardEntry[];
  youthTitles: LeaderboardEntry[];
  classWins: LeaderboardEntry[];
  perfectScores: LeaderboardEntry[];
  mostStarts: LeaderboardEntry[];
  mostSeasons: LeaderboardEntry[];
  completeYears: LeaderboardEntry[];
  highestSeasons: LeaderboardEntry[];
  closeRaces: CloseTitleRace[];
  funFacts: MastarnasFunFact[];
};

function statsCache(): WeakMap<MastarnasData, ComputedStats> {
  if (!globalForStats.__rbMastarnasStats) {
    globalForStats.__rbMastarnasStats = new WeakMap();
  }
  return globalForStats.__rbMastarnasStats;
}

function person(key: string, fallback: string): { person_key: string; name: string } {
  const person_key = resolvePersonKey(key);
  return { person_key, name: resolveDisplayName(person_key, fallback) };
}

function bump(map: Map<string, Acc>, key: string, fallbackName: string, amount = 1, year?: number) {
  const resolved = person(key, fallbackName);
  const current = map.get(resolved.person_key) ?? { name: resolved.name, value: 0, years: [] };
  current.name = resolved.name;
  current.value += amount;
  if (year !== undefined && !current.years.includes(year)) {
    current.years.push(year);
  }
  map.set(resolved.person_key, current);
}

function toLeaderboard(map: Map<string, Acc>, limit: number, detail?: (acc: Acc) => string | undefined): LeaderboardEntry[] {
  return [...map.entries()]
    .map(([person_key, acc]) => ({
      person_key,
      display_name: acc.name,
      value: acc.value,
      detail: detail?.(acc),
    }))
    .sort((a, b) => b.value - a.value || a.display_name.localeCompare(b.display_name, "sv"))
    .slice(0, limit);
}

function yearList(years: number[]): string {
  return [...years].sort((a, b) => a - b).join(", ");
}

function scoredEventCount(season: MastarnasSeason): number {
  return season.events.filter((event) => event.results.length > 0).length;
}

function compute(data: MastarnasData): ComputedStats {
  const people = new Set<string>();
  let startCount = 0;
  let eventCount = 0;
  const participantsByYearMap = new Map<number, Set<string>>();
  const startsByDisciplineMap = new Map<string, number>();
  const titles = new Map<string, Acc>();
  const youthTitles = new Map<string, Acc>();
  const classWins = new Map<string, Acc>();
  const perfectScores = new Map<string, Acc>();
  const mostStarts = new Map<string, Acc>();
  const seasonYears = new Map<string, Acc>();
  const completeBest = new Map<string, Acc>();
  const highestSeasons = new Map<string, Acc>();
  const closeRaces: CloseTitleRace[] = [];

  const disciplineName = new Map(data.disciplines.map((item) => [item.id, item.name]));
  const years = data.seasons.map((season) => season.year).sort((a, b) => a - b);

  for (const season of data.seasons) {
    const yearPeople = participantsByYearMap.get(season.year) ?? new Set<string>();
    const disciplinesThisYear = new Map<string, Set<string>>();

    for (const event of season.events) {
      if (event.results.length > 0) {
        eventCount += 1;
      }
      startsByDisciplineMap.set(
        event.discipline_id,
        (startsByDisciplineMap.get(event.discipline_id) ?? 0) + event.results.length,
      );
      const points = resultPoints(event.results);
      const bestInClass = new Map<string, number>();
      for (const result of event.results) {
        const value = points.get(result.id) ?? 0;
        bestInClass.set(result.class_id, Math.max(bestInClass.get(result.class_id) ?? 0, value));
      }
      for (const result of event.results) {
        startCount += 1;
        const resolved = person(result.person_key, result.name);
        people.add(resolved.person_key);
        yearPeople.add(resolved.person_key);
        bump(mostStarts, result.person_key, result.name, 1, season.year);
        bump(seasonYears, result.person_key, result.name, 0, season.year);
        const value = points.get(result.id) ?? 0;
        if (value > 0) {
          const set = disciplinesThisYear.get(resolved.person_key) ?? new Set<string>();
          set.add(event.discipline_id);
          disciplinesThisYear.set(resolved.person_key, set);
        }
        if (value === 24) {
          bump(perfectScores, result.person_key, result.name, 1, season.year);
        }
        const classBest = bestInClass.get(result.class_id) ?? 0;
        if (value > 0 && value === classBest) {
          bump(classWins, result.person_key, result.name, 1, season.year);
        }
      }
    }
    participantsByYearMap.set(season.year, yearPeople);

    for (const [person_key, discs] of disciplinesThisYear) {
      const current = completeBest.get(person_key);
      const name = seasonYears.get(person_key)?.name ?? person_key;
      if (!current || discs.size > current.value) {
        completeBest.set(person_key, { name, value: discs.size, years: [season.year] });
      } else if (discs.size === current.value) {
        current.years.push(season.year);
      }
    }

    if (scoredEventCount(season) < MIN_EVENTS_FOR_TITLES) {
      continue;
    }

    const rows = computeStandings(data, season);
    const awards = getSeasonAwards(data, season.year, rows);
    for (const row of awards.overall) {
      bump(titles, row.person_key, row.name, 1, season.year);
    }
    for (const row of awards.youth) {
      bump(youthTitles, row.person_key, row.name, 1, season.year);
    }

    for (const row of rows) {
      const resolved = person(row.person_key, row.name);
      const current = highestSeasons.get(resolved.person_key);
      if (!current || row.total > current.value) {
        highestSeasons.set(resolved.person_key, { name: resolved.name, value: row.total, years: [season.year] });
      }
    }

    const leaderPlace = rows[0]?.place ?? 1;
    const leaders = rows.filter((row) => row.place === leaderPlace);
    const chasers = rows.filter((row) => row.place !== leaderPlace).slice(0, 2);
    if (leaders.length > 0 && (chasers.length > 0 || leaders.length > 1)) {
      const chaseTotal = chasers[0]?.total ?? leaders[0]!.total;
      closeRaces.push({
        year: season.year,
        margin: leaders.length > 1 ? 0 : Math.round((leaders[0]!.total - chaseTotal) * 100) / 100,
        leaders: leaders.map((row) => {
          const resolved = person(row.person_key, row.name);
          return { person_key: resolved.person_key, display_name: resolved.name, total: row.total };
        }),
        chasers: chasers.map((row) => {
          const resolved = person(row.person_key, row.name);
          return { person_key: resolved.person_key, display_name: resolved.name, total: row.total };
        }),
      });
    }
  }

  for (const acc of seasonYears.values()) {
    acc.value = acc.years.length;
  }

  closeRaces.sort((a, b) => a.margin - b.margin || b.year - a.year);

  const overview: MastarnasOverviewStats = {
    seasonCount: data.seasons.length,
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
    peopleCount: people.size,
    startCount,
    eventCount,
  };

  const participantsByYear: YearCount[] = [...participantsByYearMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, set]) => ({ year: String(year), count: set.size }));

  const startsByDiscipline: CountEntry[] = [...startsByDisciplineMap.entries()]
    .map(([id, count]) => ({ label: disciplineName.get(id) ?? id, count }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const mostSeasons = toLeaderboard(seasonYears, 10, (acc) => yearSpan(acc.years));
  const perfect = toLeaderboard(perfectScores, 10, (acc) => `${acc.years.length} säsonger`);
  const iron = toLeaderboard(completeBest, 10, (acc) => {
    const latest = Math.max(...acc.years);
    return acc.years.length > 1 ? `${acc.years.length} gånger, senast ${latest}` : String(latest);
  });

  const funFacts: MastarnasFunFact[] = [];
  const titleKing = toLeaderboard(titles, 1, (acc) => yearList(acc.years))[0];
  if (titleKing) {
    funFacts.push({
      eyebrow: "Flest titlar",
      title: titleKing.display_name,
      detail: `${titleKing.value} × Mästarnas Mästare · ${titleKing.detail}`,
      href: `/person/${encodeURIComponent(titleKing.person_key)}`,
    });
  }
  const ironKing = iron[0];
  if (ironKing) {
    funFacts.push({
      eyebrow: "Komplett år",
      title: ironKing.display_name,
      detail: `${ironKing.value} grenar på en säsong · ${ironKing.detail}`,
      href: `/person/${encodeURIComponent(ironKing.person_key)}`,
    });
  }
  const seasonKing = mostSeasons[0];
  if (seasonKing) {
    funFacts.push({
      eyebrow: "Alltid med",
      title: seasonKing.display_name,
      detail: `${seasonKing.value} säsonger i cupen`,
      href: `/person/${encodeURIComponent(seasonKing.person_key)}`,
    });
  }

  return {
    overview,
    participantsByYear,
    startsByDiscipline,
    titles: toLeaderboard(titles, 10, (acc) => yearList(acc.years)),
    youthTitles: toLeaderboard(youthTitles, 10, (acc) => yearList(acc.years)),
    classWins: toLeaderboard(classWins, 10),
    perfectScores: perfect,
    mostStarts: toLeaderboard(mostStarts, 10),
    mostSeasons,
    completeYears: iron,
    highestSeasons: toLeaderboard(highestSeasons, 10, (acc) => String(acc.years[0])),
    closeRaces: closeRaces.slice(0, 8),
    funFacts,
  };
}

function yearSpan(years: number[]): string {
  if (years.length === 0) {
    return "";
  }
  const sorted = [...years].sort((a, b) => a - b);
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}

export function getMastarnasCupStats(): ComputedStats {
  const data = readMastarnasData();
  const cached = statsCache().get(data);
  if (cached) {
    return cached;
  }
  const computed = compute(data);
  statsCache().set(data, computed);
  return computed;
}

export function formatMargin(margin: number): string {
  if (margin === 0) {
    return "delad titel";
  }
  return `${formatPoints(margin)} p`;
}
