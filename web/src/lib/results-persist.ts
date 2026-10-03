import fs from "fs";
import path from "path";

import {
  fetchManifestFromGitHub,
  fetchResultsIndexFromGitHub,
  isGitDeployConfigured,
  publishResultsDataToGitHub,
} from "./github-deploy";
import { rebuildPeopleIndexFromResults } from "./rebuild-people-index";
import { ensureDbSnapshot, getEvent, getEvents, getResultsIndex } from "./data";
import { isDbEnabled } from "./db/config";
import { syncResultsAndPeopleIntoDb } from "./db/write";
import { refreshDbSnapshot } from "./db/store";
import type { ResultRow } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const RESULTS_INDEX_PATH = path.join(DATA_DIR, "results-index.json");
const PEOPLE_INDEX_PATH = path.join(DATA_DIR, "people-index.json");

export type ResultsDeployResult = {
  mode: "local" | "git" | "db";
  ok: boolean;
  message: string;
};

function writeResultsDataLocal(results: ResultRow[], peopleJson: string): void {
  fs.writeFileSync(RESULTS_INDEX_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf-8");
  fs.writeFileSync(PEOPLE_INDEX_PATH, peopleJson, "utf-8");
}

export async function loadMutableResultsIndex(): Promise<ResultRow[]> {
  if (isDbEnabled()) {
    await ensureDbSnapshot();
  }

  if (!isDbEnabled() && isGitDeployConfigured()) {
    return fetchResultsIndexFromGitHub();
  }

  return getResultsIndex();
}

export async function loadMutableEvents() {
  if (!isDbEnabled() && isGitDeployConfigured()) {
    return fetchManifestFromGitHub();
  }
  return getEvents();
}

export async function persistResultsData(
  results: ResultRow[],
  peopleJson: string,
  message: string,
  successMessages: { db: string; local: string },
): Promise<ResultsDeployResult> {
  if (isDbEnabled()) {
    const events = getEvents();
    await syncResultsAndPeopleIntoDb(results, events);
    writeResultsDataLocal(results, peopleJson);
    await refreshDbSnapshot();
    return { mode: "db", ok: true, message: successMessages.db };
  }

  if (isGitDeployConfigured()) {
    const result = await publishResultsDataToGitHub(results, peopleJson, message);
    return { mode: "git", ok: result.ok, message: result.message };
  }

  writeResultsDataLocal(results, peopleJson);
  return { mode: "local", ok: true, message: successMessages.local };
}

export async function rebuildAndPersistResults(
  results: ResultRow[],
  commitMessage: string,
  successMessages: { db: string; local: string },
): Promise<ResultsDeployResult> {
  const events = await loadMutableEvents();
  const people = rebuildPeopleIndexFromResults(results, events);
  const peopleJson = `${JSON.stringify(people, null, 2)}\n`;
  return persistResultsData(results, peopleJson, commitMessage, successMessages);
}

export { getEvent };
