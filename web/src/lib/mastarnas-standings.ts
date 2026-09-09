import { COUNTED_RESULTS, resultPoints, sumAllResults, sumBestResults } from "./mastarnas-points";
import type {
  MastarnasClass,
  MastarnasData,
  MastarnasDiscipline,
  MastarnasSeason,
} from "./mastarnas-types";

export type StandingRow = {
  person_key: string;
  name: string;
  class_id: string;
  class_name: string;
  is_youth: boolean;
  place: number;
  total: number;
  totalAll: number;
  starts: number;
  medel: number;
  byDiscipline: Record<string, number | null>;
};

const globalForStandings = globalThis as typeof globalThis & {
  __rbStandingsBySeasonV2?: WeakMap<MastarnasSeason, StandingRow[]>;
};

function standingsBySeason(): WeakMap<MastarnasSeason, StandingRow[]> {
  if (!globalForStandings.__rbStandingsBySeasonV2) {
    globalForStandings.__rbStandingsBySeasonV2 = new WeakMap();
  }
  return globalForStandings.__rbStandingsBySeasonV2;
}

export type SeasonAwards = {
  overall: StandingRow | null;
  youth: StandingRow | null;
  previousOverallKeys: string[];
  previousYouthKeys: string[];
};

function classById(data: MastarnasData): Map<string, MastarnasClass> {
  return new Map(data.classes.map((item) => [item.id, item]));
}

function medelDisciplineId(disciplines: MastarnasDiscipline[]): string | null {
  return disciplines.find((item) => item.is_medel)?.id ?? null;
}

export function computeStandings(data: MastarnasData, season: MastarnasSeason): StandingRow[] {
  const cached = standingsBySeason().get(season);
  if (cached) {
    return cached;
  }

  const classes = classById(data);
  const medelId = medelDisciplineId(data.disciplines);
  type Acc = {
    name: string;
    classCounts: Map<string, number>;
    byDiscipline: Record<string, number>;
  };
  const people = new Map<string, Acc>();

  for (const event of season.events) {
    const points = resultPoints(event.results);
    for (const result of event.results) {
      const value = points.get(result.id) ?? 0;
      if (value <= 0) {
        continue;
      }
      const acc = people.get(result.person_key) ?? {
        name: result.name,
        classCounts: new Map<string, number>(),
        byDiscipline: {},
      };
      acc.name = result.name;
      acc.classCounts.set(result.class_id, (acc.classCounts.get(result.class_id) ?? 0) + 1);
      const previous = acc.byDiscipline[event.discipline_id] ?? 0;
      acc.byDiscipline[event.discipline_id] = Math.max(previous, value);
      people.set(result.person_key, acc);
    }
  }

  const rows: Omit<StandingRow, "place">[] = [...people.entries()].map(([person_key, acc]) => {
    const class_id =
      [...acc.classCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "okand";
    const klass = classes.get(class_id);
    const values = Object.values(acc.byDiscipline);
    const byDiscipline: Record<string, number | null> = {};
    for (const discipline of data.disciplines) {
      byDiscipline[discipline.id] = acc.byDiscipline[discipline.id] ?? null;
    }
    return {
      person_key,
      name: acc.name,
      class_id,
      class_name: klass?.name ?? class_id,
      is_youth: klass?.is_youth ?? false,
      total: sumBestResults(values, COUNTED_RESULTS),
      totalAll: sumAllResults(values),
      starts: values.length,
      medel: medelId ? (acc.byDiscipline[medelId] ?? 0) : 0,
      byDiscipline,
    };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    if (b.starts !== a.starts) {
      return b.starts - a.starts;
    }
    return b.medel - a.medel;
  });

  const ranked = assignStandingPlaces(rows);
  standingsBySeason().set(season, ranked);
  return ranked;
}

function assignStandingPlaces(rows: Omit<StandingRow, "place">[]): StandingRow[] {
  return rows.map((row, index) => {
    const previous = index > 0 ? rows[index - 1] : null;
    const tied =
      !!previous &&
      previous.total === row.total &&
      previous.starts === row.starts &&
      previous.medel === row.medel;
    const place = tied ? (undefined as unknown as number) : index + 1;
    return { ...row, place };
  }).reduce<StandingRow[]>((list, row) => {
    const place = row.place || list[list.length - 1]?.place || 1;
    list.push({ ...row, place });
    return list;
  }, []);
}

export function standingsForClass(rows: StandingRow[], classId: string | null): StandingRow[] {
  const filtered = classId ? rows.filter((row) => row.class_id === classId) : rows;
  return assignStandingPlaces(filtered);
}

export function standingsForYouth(rows: StandingRow[]): StandingRow[] {
  return assignStandingPlaces(rows.filter((row) => row.is_youth));
}

export function getSeasonAwards(
  data: MastarnasData,
  year: number,
  rows: StandingRow[],
): SeasonAwards {
  const overall = rows[0] ?? null;
  const youthPool = rows.filter((row) => row.is_youth);
  const youth = overall && !overall.is_youth ? (youthPool[0] ?? null) : overall?.is_youth ? overall : youthPool[0] ?? null;

  const previousOverallKeys: string[] = [];
  const previousYouthKeys: string[] = [];
  for (const season of data.seasons) {
    if (season.year >= year) {
      continue;
    }
    const previous = computeStandings(data, season);
    if (previous[0]) {
      previousOverallKeys.push(previous[0].person_key);
      const prevYouth = previous.find((row) => row.is_youth);
      if (prevYouth) {
        previousYouthKeys.push(prevYouth.person_key);
      }
    }
  }

  return { overall, youth, previousOverallKeys, previousYouthKeys };
}

export function personSeasonRows(data: MastarnasData, personKey: string): {
  year: number;
  row: StandingRow;
}[] {
  const matches: { year: number; row: StandingRow }[] = [];
  for (const season of data.seasons) {
    const row = computeStandings(data, season).find((item) => item.person_key === personKey);
    if (row) {
      matches.push({ year: season.year, row });
    }
  }
  return matches.sort((a, b) => b.year - a.year);
}
