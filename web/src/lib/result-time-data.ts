import fs from "fs";
import path from "path";

import {
  fetchManifestFromGitHub,
  fetchResultsIndexFromGitHub,
  isGitDeployConfigured,
  publishResultsDataToGitHub,
} from "./github-deploy";
import { rebuildPeopleIndexFromResults } from "./rebuild-people-index";
import { getEvent, getEvents, getResultsIndex } from "./data";
import { isValidCorrectedTime } from "./time";
import type { ResultRow } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const RESULTS_INDEX_PATH = path.join(DATA_DIR, "results-index.json");
const PEOPLE_INDEX_PATH = path.join(DATA_DIR, "people-index.json");

export type ResultTimeRowKey = {
  event_id: number;
  person_key: string;
  class_name: string | null;
  place: number | null;
  time: string;
};

export type SaveResultTimeResult = {
  time: string;
  deploy: { mode: "local" | "git"; ok: boolean; message: string };
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

function writeResultsDataLocal(results: ResultRow[], peopleJson: string): void {
  fs.writeFileSync(RESULTS_INDEX_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf-8");
  fs.writeFileSync(PEOPLE_INDEX_PATH, peopleJson, "utf-8");
}

async function persistResultsData(
  results: ResultRow[],
  peopleJson: string,
  message: string,
): Promise<SaveResultTimeResult["deploy"]> {
  if (isGitDeployConfigured()) {
    const result = await publishResultsDataToGitHub(results, peopleJson, message);
    return { mode: "git", ok: result.ok, message: result.message };
  }

  writeResultsDataLocal(results, peopleJson);
  return { mode: "local", ok: true, message: "Tid sparad och index uppdaterat." };
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
    throw new Error("Ogiltig tid — ange t.ex. 46:34, 1:05:30 eller 58.23 (max 3 timmar).");
  }

  const event = getEvent(key.event_id);
  if (!event) {
    throw new Error("Eventet finns inte.");
  }

  const results = isGitDeployConfigured() ? await fetchResultsIndexFromGitHub() : getResultsIndex();
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

  const events = isGitDeployConfigured() ? await fetchManifestFromGitHub() : getEvents();
  const people = rebuildPeopleIndexFromResults(results, events);
  const peopleJson = `${JSON.stringify(people, null, 2)}\n`;

  const personName = updatedRow.name;
  const deploy = await persistResultsData(
    results,
    peopleJson,
    `Rätta tid: ${personName} (${key.event_id}) → ${trimmed}`,
  );

  return { time: trimmed, deploy };
}
