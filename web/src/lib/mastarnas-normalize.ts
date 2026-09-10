import type { MastarnasData, MastarnasEvent, MastarnasResult } from "./mastarnas-types";

/** Older cup names that now share a slot with a current discipline. */
export const DISCIPLINE_ALIASES: Record<string, string> = {
  kort: "medel",
  dag: "lang",
};

export function canonicalDisciplineId(id: string): string {
  return DISCIPLINE_ALIASES[id] ?? id;
}

function resultRank(row: MastarnasResult): number {
  const points = row.points ?? 0;
  const place = row.place == null ? 0 : Math.max(0, 1000 - row.place);
  return points * 1000 + place;
}

function mergeEvents(primary: MastarnasEvent, extra: MastarnasEvent, name: string): MastarnasEvent {
  const best = new Map<string, MastarnasResult>();
  for (const row of [...primary.results, ...extra.results]) {
    const previous = best.get(row.person_key);
    if (!previous || resultRank(row) > resultRank(previous)) {
      best.set(row.person_key, row);
    }
  }
  return {
    ...primary,
    name,
    date: primary.date || extra.date,
    results: [...best.values()],
  };
}

export function normalizeMastarnasData(data: MastarnasData): MastarnasData {
  const disciplines = data.disciplines.filter((item) => !DISCIPLINE_ALIASES[item.id]);
  const nameById = new Map(disciplines.map((item) => [item.id, item.name]));

  const seasons = data.seasons.map((season) => {
    const byDiscipline = new Map<string, MastarnasEvent>();
    for (const event of season.events) {
      const disciplineId = canonicalDisciplineId(event.discipline_id);
      const name = nameById.get(disciplineId) ?? event.name;
      const incoming: MastarnasEvent = {
        ...event,
        id: `${season.year}-${disciplineId}`,
        discipline_id: disciplineId,
        name,
      };
      const existing = byDiscipline.get(disciplineId);
      byDiscipline.set(disciplineId, existing ? mergeEvents(existing, incoming, name) : incoming);
    }
    return { year: season.year, events: [...byDiscipline.values()] };
  });

  return { ...data, disciplines, seasons };
}
