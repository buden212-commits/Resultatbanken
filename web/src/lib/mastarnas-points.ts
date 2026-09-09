import type { MastarnasResult, MastarnasStatus } from "./mastarnas-types";

/** Standard table for 3+ starters. 14th and later still get the 10-point minimum. */
export const POINTS_3_PLUS = [24, 22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10] as const;
export const MIN_POINTS = 10;
export const COUNTED_RESULTS = 6;

export function formatPoints(value: number): string {
  if (!Number.isFinite(value)) {
    return "–";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}

export function placePoints(place: number, starterCount: number): number {
  if (starterCount <= 0 || place < 1) {
    return 0;
  }
  if (starterCount === 1) {
    return 21;
  }
  if (starterCount === 2) {
    if (place === 1) {
      return 22;
    }
    if (place === 2) {
      return 20;
    }
    return MIN_POINTS;
  }
  if (place <= POINTS_3_PLUS.length) {
    return POINTS_3_PLUS[place - 1];
  }
  return MIN_POINTS;
}

function roundPoints(value: number): number {
  return Math.round(value * 100) / 100;
}

export type PointRow = {
  id: string;
  place: number | null;
  status: MastarnasStatus;
};

/**
 * Assigns cup points for one class in one event.
 * Shared places average the table slots they occupy (e.g. two in 3rd → (20+19)/2 = 19.5).
 * DNS does not count as a starter. DNF counts as a starter and gets the 10-point minimum.
 */
export function assignClassPoints<T extends PointRow>(rows: T[]): (T & { points: number })[] {
  const starterCount = rows.filter((row) => row.status !== "dns").length;
  const finishers = rows.filter((row) => row.status === "ok" && row.place !== null && row.place >= 1);

  const groupSizes = new Map<number, number>();
  for (const row of finishers) {
    const place = row.place as number;
    groupSizes.set(place, (groupSizes.get(place) ?? 0) + 1);
  }

  const pointsByPlace = new Map<number, number>();
  for (const [place, size] of groupSizes) {
    let sum = 0;
    for (let offset = 0; offset < size; offset += 1) {
      sum += placePoints(place + offset, starterCount);
    }
    pointsByPlace.set(place, roundPoints(sum / size));
  }

  return rows.map((row) => {
    if (row.status === "dns") {
      return { ...row, points: 0 };
    }
    if (row.status === "dnf" || row.place === null || row.place < 1) {
      return { ...row, points: starterCount === 0 ? 0 : MIN_POINTS };
    }
    return { ...row, points: pointsByPlace.get(row.place) ?? MIN_POINTS };
  });
}

export function resultPoints(results: MastarnasResult[]): Map<string, number> {
  const byClass = new Map<string, MastarnasResult[]>();
  for (const result of results) {
    const list = byClass.get(result.class_id) ?? [];
    list.push(result);
    byClass.set(result.class_id, list);
  }

  const points = new Map<string, number>();
  for (const classResults of byClass.values()) {
    const calculated = assignClassPoints(classResults);
    for (const scored of calculated) {
      points.set(scored.id, scored.points);
    }
    for (const result of classResults) {
      if (result.points !== null && result.points !== undefined) {
        points.set(result.id, result.points);
      }
    }
  }
  return points;
}

export function sumBestResults(values: number[], count = COUNTED_RESULTS): number {
  const sorted = [...values].filter((value) => value > 0).sort((a, b) => b - a);
  return roundPoints(sorted.slice(0, count).reduce((sum, value) => sum + value, 0));
}
