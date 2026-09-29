import type { EventorClubResultRow } from "./eventor-person";
import { courseLengthKm, formatCourseLengthKm, formatKmPace } from "./eventor-person-stats";
import type {
  EventorLeaderboardBoard,
  EventorLeaderboardEntry,
  EventorLeaderboardSnapshot,
  EventorLeaderboardValueKind,
} from "./eventor-leaderboard-types";
import {
  DEFAULT_EVENTOR_SPORT_FILTER,
  filterRowsBySport,
  type EventorSportFilter,
} from "./eventor-sport";

const MIN_PLACE_PCT = 5;
const MIN_FINISH_RATE = 5;
const MIN_CONSISTENCY = 5;
const MIN_FORM = 3;
const MIN_PACE = 3;
const MIN_CLASS_HOPPER = 3;
const TOP_N = 10;

type PersonAgg = {
  personId: string;
  displayName: string;
  starts: number;
  finished: number;
  wins: number;
  podiums: number;
  teamStarts: number;
  teamPodiums: number;
  championshipStarts: number;
  championshipPodiums: number;
  totalTimeSeconds: number;
  totalKm: number;
  kmTimes: number[];
  placePcts: number[];
  h1PlacePcts: number[];
  h2PlacePcts: number[];
  distanceKinds: Set<string>;
  classifications: Set<string>;
  classNames: Set<string>;
};

function emptyAgg(personId: string, displayName: string): PersonAgg {
  return {
    personId,
    displayName,
    starts: 0,
    finished: 0,
    wins: 0,
    podiums: 0,
    teamStarts: 0,
    teamPodiums: 0,
    championshipStarts: 0,
    championshipPodiums: 0,
    totalTimeSeconds: 0,
    totalKm: 0,
    kmTimes: [],
    placePcts: [],
    h1PlacePcts: [],
    h2PlacePcts: [],
    distanceKinds: new Set(),
    classifications: new Set(),
    classNames: new Set(),
  };
}

function placePct(row: EventorClubResultRow): number | null {
  if (
    row.place === null ||
    row.place <= 0 ||
    row.startsInClass === null ||
    row.startsInClass <= 0
  ) {
    return null;
  }
  return row.place / row.startsInClass;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg === null) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function halfOfYear(date: string): 1 | 2 | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const month = Number(date.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month <= 6 ? 1 : 2;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "–";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString("sv-SE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })} %`;
}

function board(
  id: string,
  title: string,
  subtitle: string,
  valueKind: EventorLeaderboardValueKind,
  entries: EventorLeaderboardEntry[],
): EventorLeaderboardBoard {
  return { id, title, subtitle, valueKind, entries };
}

function topEntries(
  rows: Array<{
    personId: string;
    displayName: string;
    value: number;
    detail?: string;
    tiebreak?: number;
  }>,
  direction: "asc" | "desc",
  limit = TOP_N,
): EventorLeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => {
    const primary =
      direction === "desc" ? b.value - a.value : a.value - b.value;
    if (primary !== 0) return primary;
    const secondary = (b.tiebreak ?? 0) - (a.tiebreak ?? 0);
    if (secondary !== 0) return secondary;
    return a.displayName.localeCompare(b.displayName, "sv");
  });
  return sorted.slice(0, limit).map((row) => ({
    personId: row.personId,
    displayName: row.displayName,
    value: row.value,
    detail: row.detail,
  }));
}

export function aggregateClubResults(rows: EventorClubResultRow[]): PersonAgg[] {
  const byPerson = new Map<string, PersonAgg>();

  for (const row of rows) {
    const agg = byPerson.get(row.personId) ?? emptyAgg(row.personId, row.displayName);
    if (row.displayName && !agg.displayName.startsWith("Person ")) {
      // keep first good name
    } else if (row.displayName) {
      agg.displayName = row.displayName;
    }

    agg.starts += 1;
    if (row.isTeam) agg.teamStarts += 1;
    if (row.classification === "Mästerskap") agg.championshipStarts += 1;
    if (row.classification) agg.classifications.add(row.classification);
    if (row.distanceKind) agg.distanceKinds.add(row.distanceKind);
    if (row.className) agg.classNames.add(row.className);

    if (row.status === "ok") {
      agg.finished += 1;
      if (row.place === 1) agg.wins += 1;
      if (row.place !== null && row.place <= 3) {
        agg.podiums += 1;
        if (row.isTeam) agg.teamPodiums += 1;
        if (row.classification === "Mästerskap") agg.championshipPodiums += 1;
      }
      if (!row.isTeam && row.timeSeconds && row.timeSeconds > 0) {
        agg.totalTimeSeconds += row.timeSeconds;
      }
      if (!row.isTeam) {
        const km = courseLengthKm(row.timeSeconds, row.kilometreTimeSeconds);
        if (km) agg.totalKm += km;
        if (row.kilometreTimeSeconds && row.kilometreTimeSeconds > 0) {
          agg.kmTimes.push(row.kilometreTimeSeconds);
        }
      }
      const pct = placePct(row);
      if (pct !== null && !row.isTeam) {
        agg.placePcts.push(pct);
        const half = halfOfYear(row.date);
        if (half === 1) agg.h1PlacePcts.push(pct);
        if (half === 2) agg.h2PlacePcts.push(pct);
      }
    }

    byPerson.set(row.personId, agg);
  }

  return [...byPerson.values()];
}

export function buildEventorLeaderboardSnapshot(
  year: number,
  rows: EventorClubResultRow[],
  meta: { eventsScanned: number; importedAt?: string },
  sportFilter: EventorSportFilter = DEFAULT_EVENTOR_SPORT_FILTER,
): EventorLeaderboardSnapshot {
  const filteredRows = filterRowsBySport(rows, sportFilter);
  const people = aggregateClubResults(filteredRows);

  const featured: EventorLeaderboardBoard[] = [
    board(
      "skogskm",
      "Skogskilometrar",
      "Summerar ungefär hur långt du sprungit i tävling. Banlängd räknas som löptid ÷ km-tid (t.ex. 26:33 med 6:14/km ≈ 4,3 km). Bara individuella lopp där Eventor har km-tid.",
      "km",
      topEntries(
        people
          .filter((p) => p.totalKm > 0)
          .map((p) => ({
            personId: p.personId,
            displayName: p.displayName,
            value: Math.round(p.totalKm * 10) / 10,
            detail: formatCourseLengthKm(p.totalKm),
          })),
        "desc",
      ),
    ),
    board(
      "faltkungen",
      "Fältkungen",
      `Bästa snittplacering relativt startfältet: plats ÷ starter i klassen. Exempel: 3:a av 30 = 10 %. Lägre är bättre. Minst ${MIN_PLACE_PCT} fullföljda med känd fältstorlek.`,
      "percent",
      topEntries(
        people
          .filter((p) => p.placePcts.length >= MIN_PLACE_PCT)
          .map((p) => {
            const avg = mean(p.placePcts)!;
            return {
              personId: p.personId,
              displayName: p.displayName,
              value: avg,
              detail: `${formatPercent(avg)} · ${p.placePcts.length} lopp`,
            };
          }),
        "asc",
      ),
    ),
    board(
      "formkurvan",
      "Formkurvan",
      `Störst förbättring av fältplacering från första till andra halvåret. Exempel: snitt 40 % jan–jun → 25 % jul–dec = stark formkurva. Kräver minst ${MIN_FORM} lopp per halvår.`,
      "percent",
      topEntries(
        people
          .filter(
            (p) =>
              p.h1PlacePcts.length >= MIN_FORM && p.h2PlacePcts.length >= MIN_FORM,
          )
          .map((p) => {
            const h1 = mean(p.h1PlacePcts)!;
            const h2 = mean(p.h2PlacePcts)!;
            const improvement = h1 - h2;
            return {
              personId: p.personId,
              displayName: p.displayName,
              value: improvement,
              detail: `${formatPercent(h1)} → ${formatPercent(h2)}`,
            };
          })
          .filter((row) => row.value > 0),
        "desc",
      ),
    ),
    board(
      "klasshoppare",
      "Klasshopparen",
      `Flest olika klassnamn under året (t.ex. H40, H45 och Öppen räknas som tre). Minst ${MIN_CLASS_HOPPER} fullföljda; vid lika antal klasser vinner den med flest fullföljda.`,
      "count",
      topEntries(
        people
          .filter((p) => p.finished >= MIN_CLASS_HOPPER && p.classNames.size > 0)
          .map((p) => ({
            personId: p.personId,
            displayName: p.displayName,
            value: p.classNames.size,
            detail: `${p.classNames.size} klasser · ${p.finished} fullföljda`,
            tiebreak: p.finished,
          })),
        "desc",
      ),
    ),
    board(
      "masterskap",
      "Mästerskapsjägaren",
      "Flest pallplatser (1–3) på Eventor-klassningen Mästerskap (SM, DM m.m.). Vid lika pall räknas flest mästerskapsstarter högst.",
      "count",
      topEntries(
        people
          .filter((p) => p.championshipStarts > 0)
          .map((p) => ({
            personId: p.personId,
            displayName: p.displayName,
            value: p.championshipPodiums,
            tiebreak: p.championshipStarts,
            detail: `${p.championshipPodiums} pall · ${p.championshipStarts} starter`,
          })),
        "desc",
      ),
    ),
    board(
      "finishrate",
      "Aldrig ge upp",
      `Högst andel fullföljda starter (OK ÷ alla starter). Exempel: 19 av 20 = 95 %. DNS/DNF/felstämpling sänker andelen. Minst ${MIN_FINISH_RATE} starter; vid 100 % vinner den med flest starter.`,
      "percent",
      topEntries(
        people
          .filter((p) => p.starts >= MIN_FINISH_RATE)
          .map((p) => {
            const rate = p.finished / p.starts;
            return {
              personId: p.personId,
              displayName: p.displayName,
              value: rate,
              tiebreak: p.starts,
              detail: `${p.finished}/${p.starts} · ${formatPercent(rate)}`,
            };
          }),
        "desc",
      ),
    ),
    board(
      "jamnhet",
      "Jämnheten",
      `Minst spridning i fältplacering (standardavvikelse). Den som oftast landar på ungefär samma nivå i fältet rankas högst — inte den snabbaste. Minst ${MIN_CONSISTENCY} lopp med plats och fältstorlek.`,
      "percent",
      topEntries(
        people
          .filter((p) => p.placePcts.length >= MIN_CONSISTENCY)
          .map((p) => {
            const spread = stdev(p.placePcts)!;
            return {
              personId: p.personId,
              displayName: p.displayName,
              value: spread,
              detail: `σ ${formatPercent(spread)} · ${p.placePcts.length} lopp`,
            };
          }),
        "asc",
      ),
    ),
    board(
      "stafett",
      "Stafetthjälten",
      "Flest stafettpallplatser (placering 1–3), därefter flest stafettstarter. Bara lag-/stafettlopp räknas — inte individuella.",
      "count",
      topEntries(
        people
          .filter((p) => p.teamStarts > 0)
          .map((p) => ({
            personId: p.personId,
            displayName: p.displayName,
            value: p.teamPodiums,
            tiebreak: p.teamStarts,
            detail: `${p.teamPodiums} pall · ${p.teamStarts} starter`,
          })),
        "desc",
      ),
    ),
    board(
      "tidsbank",
      "Tidsbanken",
      "Längst sammanlagd löptid i individuella fullföljda lopp. Exempel: tre lopp på 45, 50 och 55 min = 2h 30m. Stafetter räknas inte.",
      "duration",
      topEntries(
        people
          .filter((p) => p.totalTimeSeconds > 0)
          .map((p) => ({
            personId: p.personId,
            displayName: p.displayName,
            value: p.totalTimeSeconds,
            detail: formatDuration(p.totalTimeSeconds),
          })),
        "desc",
      ),
    ),
    board(
      "blixten",
      "Blixten",
      `Bästa snitt-kilometertid (lägre är snabbare). Exempel: 5:40, 6:00 och 6:20 ger snitt 6:00/km. Minst ${MIN_PACE} individuella lopp med km-tid från Eventor.`,
      "pace",
      topEntries(
        people
          .filter((p) => p.kmTimes.length >= MIN_PACE)
          .map((p) => {
            const avg = Math.round(mean(p.kmTimes)!);
            return {
              personId: p.personId,
              displayName: p.displayName,
              value: avg,
              detail: `${formatKmPace(avg)}/km · ${p.kmTimes.length} lopp`,
            };
          }),
        "asc",
      ),
    ),
  ];

  const classic: EventorLeaderboardBoard[] = [
    board(
      "starter",
      "Flest starter",
      "Totalt antal anmälda starter under året (inkl. DNS/DNF). Under raden visas hur många som fullföljdes.",
      "count",
      topEntries(
        people
          .filter((p) => p.starts > 0)
          .map((p) => ({
            personId: p.personId,
            displayName: p.displayName,
            value: p.starts,
            detail: `${p.finished} fullföljda`,
          })),
        "desc",
      ),
    ),
    board(
      "segrar",
      "Flest segrar",
      "Antal gånger du kommit etta (placering 1), både individuellt och i stafett.",
      "count",
      topEntries(
        people
          .filter((p) => p.wins > 0)
          .map((p) => ({
            personId: p.personId,
            displayName: p.displayName,
            value: p.wins,
          })),
        "desc",
      ),
    ),
    board(
      "pall",
      "Flest pallplatser",
      "Antal gånger du kommit 1:a, 2:a eller 3:a — individuellt och i stafett.",
      "count",
      topEntries(
        people
          .filter((p) => p.podiums > 0)
          .map((p) => ({
            personId: p.personId,
            displayName: p.displayName,
            value: p.podiums,
          })),
        "desc",
      ),
    ),
  ];

  return {
    year,
    importedAt: meta.importedAt ?? new Date().toISOString(),
    eventsScanned: meta.eventsScanned,
    personCount: people.length,
    resultCount: filteredRows.length,
    featured,
    classic,
    rows,
  };
}
