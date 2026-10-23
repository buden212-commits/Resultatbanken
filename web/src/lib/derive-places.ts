import type { ResultRow } from "./types";
import { isUnreasonableTime, parseTimeToSeconds } from "./time";

const NON_RANKABLE_STATUSES = new Set(["deltagit", "dns", "dnf", "felst"]);

export type DerivePlacesOptions = {
  /** When true, short/long times still count for derived places (Eventor imports). */
  ignoreUnreasonableTimes?: boolean;
};

function classGroupKey(className: string | null | undefined): string {
  return className?.trim() || "–";
}

function isRankableForDerivedPlace(row: ResultRow, ignoreUnreasonableTimes: boolean): boolean {
  if (row.place !== null) {
    return false;
  }
  if (!row.time?.trim()) {
    return false;
  }
  if (row.status && NON_RANKABLE_STATUSES.has(row.status)) {
    return false;
  }
  if (!ignoreUnreasonableTimes && isUnreasonableTime(row.time)) {
    return false;
  }
  return parseTimeToSeconds(row.time) !== null;
}

function derivePlacesForClassGroup(
  rows: ResultRow[],
  ignoreUnreasonableTimes: boolean,
): ResultRow[] {
  const rankable = rows.filter((row) => isRankableForDerivedPlace(row, ignoreUnreasonableTimes));
  if (rankable.length === 0) {
    return rows;
  }

  const sorted = [...rankable].sort((a, b) => {
    const left = parseTimeToSeconds(a.time!)!;
    const right = parseTimeToSeconds(b.time!)!;
    return left - right;
  });

  const placeByKey = new Map<string, number>();
  for (let index = 0; index < sorted.length; index += 1) {
    let place = index + 1;
    if (index > 0) {
      const previousSeconds = parseTimeToSeconds(sorted[index - 1].time!)!;
      const currentSeconds = parseTimeToSeconds(sorted[index].time!)!;
      if (currentSeconds === previousSeconds) {
        place = placeByKey.get(rowKey(sorted[index - 1]))!;
      }
    }
    placeByKey.set(rowKey(sorted[index]), place);
  }

  return rows.map((row) => {
    const derived = placeByKey.get(rowKey(row));
    if (derived === undefined) {
      return row;
    }
    return { ...row, place: derived };
  });
}

function rowKey(row: ResultRow): string {
  return `${row.person_key}|${classGroupKey(row.class_name)}`;
}

/** Assign placering within each class_name group from times when place is missing. */
export function derivePlaces(rows: ResultRow[], options?: DerivePlacesOptions): ResultRow[] {
  const ignoreUnreasonableTimes = options?.ignoreUnreasonableTimes ?? false;
  const groups = new Map<string, ResultRow[]>();

  for (const row of rows) {
    const key = classGroupKey(row.class_name);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.values()].flatMap((group) =>
    derivePlacesForClassGroup(group, ignoreUnreasonableTimes),
  );
}
