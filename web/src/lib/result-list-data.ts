import {
  getEvent,
  loadMutableResultsIndex,
  rebuildAndPersistResults,
  type ResultsDeployResult,
} from "./results-persist";
import { toSlug } from "./slug";
import type { ResultRow } from "./types";

export type EditableResultInput = {
  name: string;
  person_key?: string;
  club?: string | null;
  class_name?: string | null;
  place?: number | null;
  time?: string | null;
  status?: string | null;
};

export type SaveEventResultListResult = {
  rowCount: number;
  deploy: ResultsDeployResult;
};

const KNOWN_STATUSES = new Set(["dns", "dnf", "felst", "deltagit"]);

function normalizeStatus(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "ok" || trimmed === "fullföljt") {
    return null;
  }
  return KNOWN_STATUSES.has(trimmed) ? trimmed : trimmed;
}

function normalizePlace(value: number | null | undefined, status: string | null): number | null {
  if (status !== null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null;
  }
  return value;
}

function normalizeTime(value: string | null | undefined, status: string | null): string | null {
  if (status !== null) {
    return null;
  }
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function normalizeEditableResults(
  eventId: number,
  rows: EditableResultInput[],
): ResultRow[] {
  const normalized: ResultRow[] = [];

  for (const [index, row] of rows.entries()) {
    const name = row.name?.trim() ?? "";
    if (!name) {
      throw new Error(`Rad ${index + 1}: namn krävs.`);
    }

    const status = normalizeStatus(row.status);
    const personKey = row.person_key?.trim() || toSlug(name);
    if (!personKey) {
      throw new Error(`Rad ${index + 1}: kunde inte skapa personnyckel från namnet.`);
    }

    const club = row.club?.trim() ? row.club.trim() : null;
    const className = row.class_name?.trim() ? row.class_name.trim() : null;

    normalized.push({
      event_id: eventId,
      person_key: personKey,
      name,
      club,
      class_name: className,
      place: normalizePlace(row.place, status),
      time: normalizeTime(row.time, status),
      status,
      parse_source: "manual",
      parse_confidence: "high",
    });
  }

  return normalized;
}

export async function saveEventResultList(
  eventId: number,
  rows: EditableResultInput[],
): Promise<SaveEventResultListResult> {
  const existing = await loadMutableResultsIndex();
  const event = getEvent(eventId);
  if (!event) {
    throw new Error("Eventet finns inte.");
  }

  const eventRows = normalizeEditableResults(eventId, rows);
  const results = [...existing.filter((row) => row.event_id !== eventId), ...eventRows];

  const deploy = await rebuildAndPersistResults(
    results,
    `Redigera resultatlista: ${event.name || eventId} (${eventId})`,
    {
      db: "Resultatlistan sparad i databasen.",
      local: "Resultatlistan sparad och index uppdaterat.",
    },
  );

  return { rowCount: eventRows.length, deploy };
}
