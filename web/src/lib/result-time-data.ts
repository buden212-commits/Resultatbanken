import {
  getEvent,
  loadMutableResultsIndex,
  rebuildAndPersistResults,
  type ResultsDeployResult,
} from "./results-persist";
import { isValidCorrectedTime } from "./time";
import type { ResultRow } from "./types";

export type ResultTimeRowKey = {
  event_id: number;
  person_key: string;
  class_name: string | null;
  place: number | null;
  time: string;
};

export type SaveResultTimeResult = {
  time: string;
  deploy: ResultsDeployResult;
};

function matchesRow(row: ResultRow, key: ResultTimeRowKey): boolean {
  return (
    row.event_id === key.event_id &&
    row.person_key === key.person_key &&
    (row.class_name ?? null) === key.class_name &&
    (row.place ?? null) === key.place &&
    row.time === key.time
  );
}

export async function saveCorrectedResultTime(
  key: ResultTimeRowKey,
  correctedTime: string,
): Promise<SaveResultTimeResult> {
  const trimmed = correctedTime.trim();
  if (!trimmed) {
    throw new Error("Tid krävs.");
  }
  if (!isValidCorrectedTime(trimmed)) {
    throw new Error("Ogiltig tid — ange t.ex. 46:34, 1:05:30 eller 58.23 (8 min–3 tim).");
  }

  const results = await loadMutableResultsIndex();
  const event = getEvent(key.event_id);
  if (!event) {
    throw new Error("Eventet finns inte.");
  }

  const index = results.findIndex((row) => matchesRow(row, key));

  if (index === -1) {
    throw new Error("Resultatraden hittades inte.");
  }

  const updatedRow = {
    ...results[index],
    time: trimmed,
    parse_source: "manual",
    parse_confidence: "high",
  };
  results[index] = updatedRow;

  const personName = updatedRow.name;
  const deploy = await rebuildAndPersistResults(
    results,
    `Rätta tid: ${personName} (${key.event_id}) → ${trimmed}`,
    {
      db: "Tid sparad i databasen.",
      local: "Tid sparad och index uppdaterat.",
    },
  );

  return { time: trimmed, deploy };
}
