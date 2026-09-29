import type { EventorClubResultRow } from "./eventor-person";

export type EventorLeaderboardValueKind =
  | "count"
  | "duration"
  | "pace"
  | "km"
  | "percent"
  | "ratio"
  | "points";

export type EventorLeaderboardEntry = {
  personId: string;
  displayName: string;
  value: number;
  detail?: string;
};

export type EventorLeaderboardBoard = {
  id: string;
  title: string;
  subtitle: string;
  valueKind: EventorLeaderboardValueKind;
  entries: EventorLeaderboardEntry[];
};

export type EventorLeaderboardSnapshot = {
  year: number;
  importedAt: string;
  eventsScanned: number;
  personCount: number;
  resultCount: number;
  featured: EventorLeaderboardBoard[];
  classic: EventorLeaderboardBoard[];
  /** Raw year rows so UI can refilter MTBO/SkidO without re-import. */
  rows?: EventorClubResultRow[];
};

export type EventorLeaderboardsData = {
  byYear: Record<string, EventorLeaderboardSnapshot>;
};

export function emptyEventorLeaderboards(): EventorLeaderboardsData {
  return { byYear: {} };
}
