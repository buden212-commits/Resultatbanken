export type EventorSportKind = "footo" | "mtbo" | "skio" | "other";

/**
 * Eventor DisciplineId (svenska Eventor): 1 FootO, 2 SkiO, 3 MTBO.
 * Namnmatchning som fallback när discipline saknas.
 */
export function detectEventorSportKind(input: {
  eventName?: string | null;
  className?: string | null;
  disciplineId?: string | null;
}): EventorSportKind {
  const id = String(input.disciplineId ?? "").trim();
  if (id === "1") return "footo";
  if (id === "2") return "skio";
  if (id === "3") return "mtbo";

  const hay = `${input.eventName ?? ""} ${input.className ?? ""}`.toLocaleLowerCase("sv");
  if (/\bmtb\b|mtbo|mtb[\s-]?o|mountain\s*bike/.test(hay)) return "mtbo";
  // Avoid matching plain "skidor" — require skido / skid-o / ski-o / skidorientering.
  if (
    /skidorientering|skid[\s-]o\b|ski[\s-]o\b|skido(?:km|(?![a-zåäö]))/.test(hay)
  ) {
    return "skio";
  }
  return "footo";
}

export type EventorSportFilter = {
  excludeMtbo: boolean;
  excludeSkio: boolean;
};

export const DEFAULT_EVENTOR_SPORT_FILTER: EventorSportFilter = {
  excludeMtbo: true,
  excludeSkio: true,
};

export function filterRowsBySport<T extends { sportKind?: EventorSportKind | null; eventName?: string | null; className?: string | null }>(
  rows: T[],
  filter: EventorSportFilter,
): T[] {
  if (!filter.excludeMtbo && !filter.excludeSkio) return rows;
  return rows.filter((row) => {
    const kind =
      row.sportKind ??
      detectEventorSportKind({ eventName: row.eventName, className: row.className });
    if (filter.excludeMtbo && kind === "mtbo") return false;
    if (filter.excludeSkio && kind === "skio") return false;
    return true;
  });
}
