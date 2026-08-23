import {
  formatDuration,
  getEvents,
  getLastYearDateRange,
  getPeopleIndex,
  getResultsIndex,
  parseTimeToSeconds,
} from "./data";
import { resolveDisplayName, resolvePersonKey } from "./person-aliases";
import type { Person, PersonResult, ResultRow } from "./types";

export type CountEntry = {
  label: string;
  count: number;
};

export type YearCount = {
  year: string;
  count: number;
};

export type LeaderboardEntry = {
  person_key: string;
  display_name: string;
  value: number;
  detail?: string;
};

export type OverviewStats = {
  eventCount: number;
  peopleCount: number;
  resultCount: number;
  eventsWithResults: number;
  rowsWithTime: number;
  rowsWithPlace: number;
  rowsWithClass: number;
  rowsWithClub: number;
  firstYear: string | null;
  lastYear: string | null;
};

export type PersonalRecord = {
  class_name: string;
  time: string;
  date: string | null;
  event_name: string;
  place: number | null;
};

export type PersonStats = {
  wins: number;
  podiums: number;
  dns: number;
  dnf: number;
  felst: number;
  deltagit: number;
  totalTimeSeconds: number;
  uniqueEvents: number;
  uniqueYears: number;
  bestPlace: number | null;
  resultsByYear: YearCount[];
  personalRecords: PersonalRecord[];
  topLocations: CountEntry[];
  topEventTypes: CountEntry[];
  longestStreakYears: number;
};

type PersonAggregate = {
  person_key: string;
  display_name: string;
  resultCount: number;
  eventIds: Set<number>;
  wins: number;
  podiums: number;
  totalTimeSeconds: number;
  firstDate: string | null;
  lastDate: string | null;
  byYear: Map<string, number>;
};

function getEventDateLookup(): Map<number, string> {
  return new Map(getEvents().map((event) => [event.id, event.date]));
}

function getEventMetaLookup(): Map<
  number,
  { date: string; type: string; location: string; name: string }
> {
  return new Map(
    getEvents().map((event) => [
      event.id,
      {
        date: event.date,
        type: event.type?.trim() || "Okänd typ",
        location: event.location?.trim() || "Okänd plats",
        name: event.name,
      },
    ]),
  );
}

function isWithinRange(date: string | null, from: string, to: string): boolean {
  return !!date && date >= from && date <= to;
}

function normalizeLabel(value: string): string {
  return value.trim() || "Okänt";
}

function buildPersonAggregates(range?: { from: string; to: string }): Map<string, PersonAggregate> {
  const eventDates = getEventDateLookup();
  const aggregates = new Map<string, PersonAggregate>();

  for (const row of getResultsIndex()) {
    const date = eventDates.get(row.event_id) ?? null;
    if (range && !isWithinRange(date, range.from, range.to)) {
      continue;
    }

    const personKey = resolvePersonKey(row.person_key);
    const displayName = resolveDisplayName(row.person_key, row.name);
    let aggregate = aggregates.get(personKey);

    if (!aggregate) {
      aggregate = {
        person_key: personKey,
        display_name: displayName,
        resultCount: 0,
        eventIds: new Set(),
        wins: 0,
        podiums: 0,
        totalTimeSeconds: 0,
        firstDate: null,
        lastDate: null,
        byYear: new Map(),
      };
      aggregates.set(personKey, aggregate);
    }

    aggregate.resultCount += 1;
    aggregate.eventIds.add(row.event_id);

    if (row.place === 1) {
      aggregate.wins += 1;
    }
    if (row.place !== null && row.place >= 1 && row.place <= 3) {
      aggregate.podiums += 1;
    }

    if (row.time) {
      const seconds = parseTimeToSeconds(row.time);
      if (seconds !== null) {
        aggregate.totalTimeSeconds += seconds;
      }
    }

    if (date) {
      if (!aggregate.firstDate || date < aggregate.firstDate) {
        aggregate.firstDate = date;
      }
      if (!aggregate.lastDate || date > aggregate.lastDate) {
        aggregate.lastDate = date;
      }
      const year = date.slice(0, 4);
      aggregate.byYear.set(year, (aggregate.byYear.get(year) ?? 0) + 1);
    }
  }

  return aggregates;
}

function toLeaderboard(
  aggregates: Map<string, PersonAggregate>,
  valueFn: (aggregate: PersonAggregate) => number,
  detailFn?: (aggregate: PersonAggregate) => string | undefined,
  limit = 10,
): LeaderboardEntry[] {
  return [...aggregates.values()]
    .map((aggregate) => ({
      person_key: aggregate.person_key,
      display_name: aggregate.display_name,
      value: valueFn(aggregate),
      detail: detailFn?.(aggregate),
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || a.display_name.localeCompare(b.display_name, "sv"))
    .slice(0, limit);
}

export function getOverviewStats(): OverviewStats {
  const events = getEvents();
  const results = getResultsIndex();
  const years = events.map((event) => event.date?.slice(0, 4)).filter(Boolean) as string[];

  return {
    eventCount: events.length,
    peopleCount: getPeopleIndex().length,
    resultCount: results.length,
    eventsWithResults: new Set(results.map((row) => row.event_id)).size,
    rowsWithTime: results.filter((row) => row.time).length,
    rowsWithPlace: results.filter((row) => row.place !== null).length,
    rowsWithClass: results.filter((row) => row.class_name).length,
    rowsWithClub: results.filter((row) => row.club).length,
    firstYear: years.length > 0 ? years.reduce((a, b) => (a < b ? a : b)) : null,
    lastYear: years.length > 0 ? years.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

export function getResultsByYear(): YearCount[] {
  const eventDates = getEventDateLookup();
  const counts = new Map<string, number>();

  for (const row of getResultsIndex()) {
    const date = eventDates.get(row.event_id);
    if (!date) {
      continue;
    }
    const year = date.slice(0, 4);
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

export function getResultsByEventType(limit = 15): CountEntry[] {
  const eventMeta = getEventMetaLookup();
  const counts = new Map<string, number>();

  for (const row of getResultsIndex()) {
    const type = normalizeLabel(eventMeta.get(row.event_id)?.type ?? "Okänd typ");
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "sv"))
    .slice(0, limit);
}

export function getResultsByLocation(limit = 15): CountEntry[] {
  const eventMeta = getEventMetaLookup();
  const counts = new Map<string, number>();

  for (const row of getResultsIndex()) {
    const location = normalizeLabel(eventMeta.get(row.event_id)?.location ?? "Okänd plats");
    counts.set(location, (counts.get(location) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "sv"))
    .slice(0, limit);
}

export function getEventsByYear(): YearCount[] {
  const counts = new Map<string, number>();

  for (const event of getEvents()) {
    if (!event.date) {
      continue;
    }
    const year = event.date.slice(0, 4);
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

export function getStatusBreakdown(): CountEntry[] {
  const labels: Record<string, string> = {
    deltagit: "Deltagit (utan tid/placering)",
    dns: "DNS — ej start",
    dnf: "DNF — gick inte i mål",
    felst: "Felstämplat / ej godkänd",
  };

  const counts = new Map<string, number>();
  for (const row of getResultsIndex()) {
    const key = row.status ?? "ok";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({
      label: key === "ok" ? "Med tid/placering" : (labels[key] ?? key),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getParseConfidenceBreakdown(): CountEntry[] {
  const counts = new Map<string, number>();
  for (const row of getResultsIndex()) {
    const key = row.parse_confidence || "okänd";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function getLeaderboardMostEvents(limit = 10, range?: { from: string; to: string }) {
  const aggregates = buildPersonAggregates(range);
  return toLeaderboard(aggregates, (a) => a.eventIds.size, undefined, limit);
}

export function getLeaderboardMostResults(limit = 10, range?: { from: string; to: string }) {
  const aggregates = buildPersonAggregates(range);
  return toLeaderboard(aggregates, (a) => a.resultCount, undefined, limit);
}

export function getLeaderboardMostWins(limit = 10, range?: { from: string; to: string }) {
  const aggregates = buildPersonAggregates(range);
  return toLeaderboard(aggregates, (a) => a.wins, undefined, limit);
}

export function getLeaderboardMostPodiums(limit = 10, range?: { from: string; to: string }) {
  const aggregates = buildPersonAggregates(range);
  return toLeaderboard(aggregates, (a) => a.podiums, undefined, limit);
}

export function getLeaderboardLongestTotalTime(limit = 10, range?: { from: string; to: string }) {
  const aggregates = buildPersonAggregates(range);
  return toLeaderboard(
    aggregates,
    (a) => a.totalTimeSeconds,
    (a) => formatDuration(a.totalTimeSeconds),
    limit,
  );
}

export function getLeaderboardLongestCareer(limit = 10) {
  const aggregates = buildPersonAggregates();
  return toLeaderboard(
    aggregates,
    (a) => {
      if (!a.firstDate || !a.lastDate) {
        return 0;
      }
      return Number.parseInt(a.lastDate.slice(0, 4), 10) - Number.parseInt(a.firstDate.slice(0, 4), 10);
    },
    (a) =>
      a.firstDate && a.lastDate
        ? `${a.firstDate.slice(0, 4)}–${a.lastDate.slice(0, 4)}`
        : undefined,
    limit,
  );
}

export function getLeaderboardBestSingleYear(limit = 10) {
  const aggregates = buildPersonAggregates();
  return toLeaderboard(
    aggregates,
    (a) => Math.max(0, ...a.byYear.values()),
    (a) => {
      const best = Math.max(0, ...a.byYear.values());
      const year = [...a.byYear.entries()].find(([, count]) => count === best)?.[0];
      return year ? `år ${year}` : undefined;
    },
    limit,
  );
}

export function getMostParticipationsInLastYear(limit = 1): LeaderboardEntry[] {
  return getLeaderboardMostEvents(limit, getLastYearDateRange());
}

export function getLongestTotalTimeInLastYear(limit = 1): LeaderboardEntry[] {
  return getLeaderboardLongestTotalTime(limit, getLastYearDateRange());
}

function computeStreakYears(years: number[]): number {
  if (years.length === 0) {
    return 0;
  }
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  let best = 1;
  let current = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === sorted[index - 1] + 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

function isCompetitiveResult(result: PersonResult | ResultRow): boolean {
  if (result.status && result.status !== "deltagit") {
    return false;
  }
  return !!result.time;
}

export function getPersonStats(person: Person): PersonStats {
  const wins = person.results.filter((r) => r.place === 1).length;
  const podiums = person.results.filter((r) => r.place !== null && r.place >= 1 && r.place <= 3).length;
  const dns = person.results.filter((r) => r.status === "dns").length;
  const dnf = person.results.filter((r) => r.status === "dnf").length;
  const felst = person.results.filter((r) => r.status === "felst").length;
  const deltagit = person.results.filter((r) => r.status === "deltagit").length;

  let totalTimeSeconds = 0;
  for (const result of person.results) {
    if (result.time) {
      const seconds = parseTimeToSeconds(result.time);
      if (seconds !== null) {
        totalTimeSeconds += seconds;
      }
    }
  }

  const yearCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const years: number[] = [];

  for (const result of person.results) {
    if (result.date) {
      const year = result.date.slice(0, 4);
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
      years.push(Number.parseInt(year, 10));
    }
    if (result.location) {
      locationCounts.set(result.location, (locationCounts.get(result.location) ?? 0) + 1);
    }
    if (result.type) {
      typeCounts.set(result.type, (typeCounts.get(result.type) ?? 0) + 1);
    }
  }

  const bestByClass = new Map<string, PersonalRecord>();
  for (const result of person.results) {
    if (!isCompetitiveResult(result) || !result.class_name || !result.time) {
      continue;
    }
    const seconds = parseTimeToSeconds(result.time);
    if (seconds === null) {
      continue;
    }
    const existing = bestByClass.get(result.class_name);
    if (!existing || (parseTimeToSeconds(existing.time) ?? Infinity) > seconds) {
      bestByClass.set(result.class_name, {
        class_name: result.class_name,
        time: result.time,
        date: result.date,
        event_name: result.event_name,
        place: result.place,
      });
    }
  }

  const places = person.results
    .map((r) => r.place)
    .filter((place): place is number => place !== null && place > 0);

  return {
    wins,
    podiums,
    dns,
    dnf,
    felst,
    deltagit,
    totalTimeSeconds,
    uniqueEvents: person.event_ids.length,
    uniqueYears: yearCounts.size,
    bestPlace: places.length > 0 ? Math.min(...places) : null,
    resultsByYear: [...yearCounts.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    personalRecords: [...bestByClass.values()].sort((a, b) =>
      a.class_name.localeCompare(b.class_name, "sv"),
    ),
    topLocations: [...locationCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    topEventTypes: [...typeCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    longestStreakYears: computeStreakYears(years),
  };
}