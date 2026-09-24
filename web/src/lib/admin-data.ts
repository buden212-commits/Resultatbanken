import { spawn } from "child_process";
import fs from "fs";
import path from "path";

import {
  fetchManifestFromGitHub,
  fetchResultsIndexFromGitHub,
  isGitDeployConfigured,
  publishEventToGitHub,
  publishManifestToGitHub,
} from "./github-deploy";
import { eventorEventUrl, fetchClubResults, fetchFullEventResults, searchEventorEvents } from "./eventor";
import type { EventorSearchHit, EventorSearchScope } from "./eventor";
import type { Event, ResultRow } from "./types";
import { isDbEnabled, isServerlessRuntime } from "./db/config";
import {
  allocateEventId,
  createEventInDb,
  replaceEventResultsInDb,
  syncEventFromJsonIntoDb,
  updateEventTypeDb,
} from "./db/write";
import { ensureDbSnapshot, getDbSnapshotSync, readContentUrlFromDb, refreshDbSnapshot } from "./db/store";
import { getDb } from "./db/client";
import { listEvents } from "./db/events";
import { parseResultListXml } from "./parse-result-xml";
import { rebuildPeopleIndexFromResults } from "./rebuild-people-index";
import { findLocalContentFile } from "./db/content";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const CONTENT_DIR = path.join(DATA_DIR, "content");
const MANIFEST_PATH = path.join(DATA_DIR, "manifest.json");
const RESULTS_INDEX_PATH = path.join(DATA_DIR, "results-index.json");
const PEOPLE_INDEX_PATH = path.join(DATA_DIR, "people-index.json");
const SCRIPTS_DIR = path.join(process.cwd(), "..", "scripts");

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".html",
  ".htm",
  ".txt",
  ".xls",
  ".xlsx",
  ".ods",
  ".doc",
  ".docx",
  ".rtf",
  ".jpeg",
  ".jpg",
  ".xml",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".htm": "text/html",
  ".txt": "text/plain",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".xml": "application/xml",
};

export type CreateEventInput = {
  name: string;
  type: string;
  date: string;
  organizer: string;
  location: string;
  free_text: string;
  source_url?: string;
};

export type DeployResult = {
  mode: "local" | "git" | "db";
  ok: boolean;
  message: string;
};

export type CreateEventResult = {
  event: Event;
  deploy: DeployResult;
};

function readManifestLocal(): Event[] {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as Event[];
}

function writeManifestLocal(events: Event[]): void {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(events, null, 2)}\n`, "utf-8");
}

function mergeEventResults(existing: ResultRow[], eventId: number, rows: ResultRow[]): ResultRow[] {
  return [...existing.filter((row) => row.event_id !== eventId), ...rows];
}

function parseXmlResultsRequired(buffer: Buffer, eventId: number): ResultRow[] {
  const rows = parseResultListXml(buffer, eventId);
  if (rows.length === 0) {
    throw new Error("Inga resultat kunde parsas från XML-filen.");
  }
  return rows;
}

function writeLocalResultIndexes(results: ResultRow[], events: Event[]): string {
  const people = rebuildPeopleIndexFromResults(results, events);
  const peopleJson = `${JSON.stringify(people, null, 2)}\n`;
  try {
    fs.writeFileSync(RESULTS_INDEX_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf-8");
    fs.writeFileSync(PEOPLE_INDEX_PATH, peopleJson, "utf-8");
  } catch {
    // Serverless / missing data dir — indexes live in DB or Git only.
  }
  return peopleJson;
}

function readLocalResultsIndex(): ResultRow[] {
  if (!fs.existsSync(RESULTS_INDEX_PATH)) return [];
  return JSON.parse(fs.readFileSync(RESULTS_INDEX_PATH, "utf-8")) as ResultRow[];
}

async function readManifest(): Promise<Event[]> {
  if (isDbEnabled()) {
    await ensureDbSnapshot();
    const db = await getDb();
    return listEvents(db);
  }
  if (isGitDeployConfigured()) {
    return fetchManifestFromGitHub();
  }
  return readManifestLocal();
}

export async function getNextEventId(): Promise<number> {
  if (isDbEnabled()) {
    return allocateEventId();
  }
  const events = await readManifest();
  return Math.max(0, ...events.map((event) => event.id)) + 1;
}

export function getEventTypes(): string[] {
  const events =
    isDbEnabled() && getDbSnapshotSync()
      ? getDbSnapshotSync()!.events
      : readManifestLocal();
  const types = new Set<string>();
  for (const event of events) {
    const value = event.type?.trim();
    if (value) {
      types.add(value);
    }
  }
  return [...types].sort((a, b) => a.localeCompare(b, "sv"));
}

export function getDeployMode(): "local" | "git" | "db" {
  if (isDbEnabled()) {
    return "db";
  }
  return isGitDeployConfigured() ? "git" : "local";
}

function resolveExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function validateInput(input: CreateEventInput, ext: string): void {
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Filtypen ${ext || "(saknas)"} stöds inte.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Ogiltigt datum — använd formatet ÅÅÅÅ-MM-DD.");
  }

  if (!input.name.trim()) {
    throw new Error("Träningsnamn krävs.");
  }
}

function buildEvent(
  id: number,
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string; storedName: string },
  ext: string,
): Event {
  return {
    id,
    name: input.name.trim(),
    type: input.type.trim(),
    date: input.date,
    organizer: input.organizer.trim(),
    location: input.location.trim(),
    free_text: input.free_text.trim(),
    result_file: file.filename,
    file_size: file.buffer.byteLength,
    file_type: MIME_BY_EXT[ext] ?? "application/octet-stream",
    source_url: input.source_url?.trim() || "",
    local_file: `content/${file.storedName}`,
    downloaded_at: new Date().toISOString(),
  };
}

function runPythonScript(scriptName: string, args: string[] = []): Promise<{ ok: boolean; message: string }> {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const candidates = process.platform === "win32" ? ["py", "python3", "python"] : ["python3", "python"];

  return new Promise((resolve) => {
    let index = 0;

    function tryNext(): void {
      if (index >= candidates.length) {
        resolve({
          ok: false,
          message: "Python hittades inte — kör scripts/extract_participants.py och scripts/rebuild_index.py manuellt.",
        });
        return;
      }

      const command = candidates[index];
      index += 1;

      const child = spawn(command, [scriptPath, ...args], {
        cwd: path.join(process.cwd(), ".."),
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });

      let output = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });

      child.on("error", () => {
        tryNext();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ ok: true, message: output.trim() || "Index uppdaterat." });
          return;
        }
        tryNext();
      });
    }

    tryNext();
  });
}

async function reindexEventLocally(eventId: number): Promise<DeployResult> {
  const extract = await runPythonScript("extract_participants.py", ["--event-id", String(eventId)]);
  if (!extract.ok) {
    return { mode: "local", ok: false, message: extract.message };
  }

  const rebuild = await runPythonScript("rebuild_index.py");
  if (!rebuild.ok) {
    return { mode: "local", ok: false, message: rebuild.message };
  }

  return {
    mode: "local",
    ok: true,
    message: [extract.message, rebuild.message].filter(Boolean).join(" "),
  };
}

async function createEventLocally(
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string },
): Promise<CreateEventResult> {
  const ext = resolveExtension(file.filename);
  validateInput(input, ext);

  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const id = await getNextEventId();
  const storedName = `${id}${ext}`;
  const storedPath = path.join(CONTENT_DIR, storedName);

  fs.writeFileSync(storedPath, file.buffer);

  const event = buildEvent(id, input, { ...file, storedName }, ext);

  const manifest = readManifestLocal();
  manifest.push(event);
  writeManifestLocal(manifest);

  if (ext === ".xml") {
    const rows = parseXmlResultsRequired(file.buffer, id);
    const results = mergeEventResults(readLocalResultsIndex(), id, rows);
    writeLocalResultIndexes(results, manifest);
    return {
      event,
      deploy: {
        mode: "local",
        ok: true,
        message: `Sparat lokalt (${rows.length} starter indexerade).`,
      },
    };
  }

  const deploy = await reindexEventLocally(id);
  return { event, deploy };
}

async function createEventViaGit(
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string },
): Promise<CreateEventResult> {
  const ext = resolveExtension(file.filename);
  validateInput(input, ext);

  const id = await getNextEventId();
  const storedName = `${id}${ext}`;
  const event = buildEvent(id, input, { ...file, storedName }, ext);

  let indexes: { results: ResultRow[]; peopleJson: string } | undefined;
  if (ext === ".xml") {
    const rows = parseXmlResultsRequired(file.buffer, id);
    const existingResults = await fetchResultsIndexFromGitHub().catch(() => readLocalResultsIndex());
    const results = mergeEventResults(existingResults, id, rows);
    const peopleJson = writeLocalResultIndexes(results, [
      ...((await fetchManifestFromGitHub().catch(() => readManifestLocal())).filter(
        (item) => item.id !== id,
      )),
      event,
    ]);
    indexes = { results, peopleJson };
  }

  const deployResult = await publishEventToGitHub(
    event,
    { buffer: file.buffer, storedName },
    indexes,
  );

  return {
    event,
    deploy: {
      mode: "git",
      ok: deployResult.ok,
      message: indexes
        ? `${deployResult.message} (${indexes.results.filter((row) => row.event_id === id).length} starter indexerade).`
        : deployResult.message,
    },
  };
}

async function extractEventLocally(eventId: number): Promise<DeployResult> {
  const extract = await runPythonScript("extract_participants.py", ["--event-id", String(eventId)]);
  if (!extract.ok) {
    return { mode: "local", ok: false, message: extract.message };
  }
  return {
    mode: "local",
    ok: true,
    message: extract.message || "Extraherat.",
  };
}

async function createEventInDatabase(
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string },
): Promise<CreateEventResult> {
  const ext = resolveExtension(file.filename);
  validateInput(input, ext);

  const id = await allocateEventId();
  const storedName = `${id}${ext}`;
  const event = buildEvent(id, input, { ...file, storedName }, ext);

  // Parse XML before persisting so a bad file never creates an empty event.
  const xmlRows = ext === ".xml" ? parseXmlResultsRequired(file.buffer, id) : null;

  const { event: saved } = await createEventInDb(event, file);

  if (xmlRows) {
    await replaceEventResultsInDb(saved.id, xmlRows);
    if (!isServerlessRuntime()) {
      const results = mergeEventResults(readLocalResultsIndex(), saved.id, xmlRows);
      writeLocalResultIndexes(results, [...readManifestLocal().filter((item) => item.id !== saved.id), saved]);
    }
    return {
      event: saved,
      deploy: {
        mode: "db",
        ok: true,
        message: `Sparat i databasen (${xmlRows.length} starter).`,
      },
    };
  }

  if (isServerlessRuntime()) {
    return {
      event: saved,
      deploy: {
        mode: "db",
        ok: false,
        message:
          "Filen sparades i Blob/DB, men parsning av PDF/Office på Vercel stöds inte ännu. Använd Eventor-XML eller importera lokalt.",
      },
    };
  }

  // Local: keep JSON manifest in sync so Python extract can find the event
  try {
    const manifest = readManifestLocal();
    if (!manifest.some((item) => item.id === saved.id)) {
      manifest.push(saved);
      writeManifestLocal(manifest);
    }
  } catch {
    // ignore missing local manifest
  }

  const extract = await extractEventLocally(id);
  if (extract.ok) {
    try {
      await syncEventFromJsonIntoDb(id);
      return {
        event: saved,
        deploy: {
          mode: "db",
          ok: true,
          message: `Sparat i databasen. ${extract.message}`.trim(),
        },
      };
    } catch (error) {
      return {
        event: saved,
        deploy: {
          mode: "db",
          ok: false,
          message: error instanceof Error ? error.message : "Kunde inte synka index till DB.",
        },
      };
    }
  }

  return {
    event: saved,
    deploy: {
      mode: "db",
      ok: false,
      message: extract.message || "Event sparat i DB men indexering misslyckades.",
    },
  };
}

export async function createEvent(
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string },
): Promise<CreateEventResult> {
  if (isDbEnabled()) {
    return createEventInDatabase(input, file);
  }
  if (isGitDeployConfigured()) {
    return createEventViaGit(input, file);
  }
  return createEventLocally(input, file);
}

function findEventorImport(manifest: Event[], eventorId: string): Event | undefined {
  const needle = `/Events/Show/${eventorId}`;
  return manifest.find((event) => event.source_url.includes(needle));
}

export type EventorSearchResultItem = EventorSearchHit & {
  alreadyImported: boolean;
  localEventId: number | null;
};

export async function searchEventorForImport(options: {
  fromDate: string;
  toDate: string;
  scope: EventorSearchScope;
  query?: string;
}): Promise<EventorSearchResultItem[]> {
  const hits = await searchEventorEvents(options);
  const manifest = await readManifest();
  return hits.map((hit) => {
    const existing = findEventorImport(manifest, hit.eventorId);
    return {
      ...hit,
      alreadyImported: Boolean(existing),
      localEventId: existing?.id ?? null,
    };
  });
}

export type CreateEventorImportResult = CreateEventResult & {
  eventorId: string;
  resultCountHint: number;
};

export async function createEventFromEventor(
  eventorIdRaw: string,
  overrides?: { type?: string; free_text?: string; resultsScope?: "club" | "full" },
): Promise<CreateEventorImportResult> {
  const eventorId = eventorIdRaw.trim();
  if (!/^\d+$/.test(eventorId)) {
    throw new Error("Ogiltigt Eventor-id — ange bara siffror.");
  }

  const resultsScope = overrides?.resultsScope === "club" ? "club" : "full";

  const manifest = await readManifest();
  const existing = findEventorImport(manifest, eventorId);
  if (existing) {
    throw new Error(
      `Eventor-event ${eventorId} finns redan som resultat ${existing.id} (${existing.name}).`,
    );
  }

  const { meta, xml } =
    resultsScope === "club"
      ? await fetchClubResults(eventorId)
      : await fetchFullEventResults(eventorId);
  const personMatches = xml.match(/<PersonResult\b/g);
  const resultCountHint = personMatches?.length ?? 0;
  if (resultCountHint === 0) {
    throw new Error(
      resultsScope === "club"
        ? `Inga klubbresultat hittades för Eventor-event ${eventorId} (${meta.name}).`
        : `Inga resultat hittades för Eventor-event ${eventorId} (${meta.name}).`,
    );
  }

  const importLabel =
    resultsScope === "club"
      ? "Importerat från Eventor (klubbresultat)."
      : "Importerat från Eventor (hela tävlingen).";

  const freeTextParts = [
    overrides?.free_text?.trim() || "",
    `${importLabel} ${eventorEventUrl(eventorId)}`,
  ].filter(Boolean);

  const input: CreateEventInput = {
    name: meta.name,
    type: overrides?.type?.trim() || meta.type,
    date: meta.date,
    organizer: meta.organizer,
    location: meta.location,
    free_text: freeTextParts.join("\n"),
    source_url: eventorEventUrl(eventorId),
  };

  const buffer = Buffer.from(xml, "utf-8");
  // Fail before creating the event if XML cannot be turned into result rows.
  parseXmlResultsRequired(buffer, 0);

  const result = await createEvent(input, {
    buffer,
    filename: `eventor-${eventorId}.xml`,
  });

  if (!result.deploy.ok) {
    throw new Error(
      result.deploy.message ||
        `Eventor-import sparades men resultat indexerades inte (event ${result.event.id}).`,
    );
  }

  return { ...result, eventorId, resultCountHint };
}

export type UpdateEventTypeResult = {
  event: Event;
  deploy: DeployResult;
};

export async function updateEventType(eventId: number, type: string): Promise<UpdateEventTypeResult> {
  const trimmed = type.trim();
  if (!trimmed) {
    throw new Error("Typ krävs.");
  }

  if (isDbEnabled()) {
    const updated = await updateEventTypeDb(eventId, trimmed);
    try {
      const manifest = readManifestLocal();
      const index = manifest.findIndex((event) => event.id === eventId);
      if (index !== -1) {
        manifest[index] = { ...manifest[index], type: trimmed };
        writeManifestLocal(manifest);
      }
    } catch {
      // Local manifest may be missing in pure DB environments.
    }
    await refreshDbSnapshot();
    return {
      event: updated,
      deploy: { mode: "db", ok: true, message: "Typ uppdaterad i databasen." },
    };
  }

  if (isGitDeployConfigured()) {
    const manifest = await fetchManifestFromGitHub();
    const index = manifest.findIndex((event) => event.id === eventId);
    if (index === -1) {
      throw new Error("Eventet finns inte.");
    }

    const updated = { ...manifest[index], type: trimmed };
    manifest[index] = updated;

    const deployResult = await publishManifestToGitHub(
      manifest,
      `Uppdatera typ: ${trimmed} (event ${eventId})`,
    );

    return {
      event: updated,
      deploy: {
        mode: "git",
        ok: deployResult.ok,
        message: deployResult.message,
      },
    };
  }

  const manifest = readManifestLocal();
  const index = manifest.findIndex((event) => event.id === eventId);
  if (index === -1) {
    throw new Error("Eventet finns inte.");
  }

  const updated = { ...manifest[index], type: trimmed };
  manifest[index] = updated;
  writeManifestLocal(manifest);

  return {
    event: updated,
    deploy: { mode: "local", ok: true, message: "Typ uppdaterad." },
  };
}

async function loadEventXmlBuffer(eventId: number): Promise<Buffer> {
  const local = findLocalContentFile(eventId);
  if (local?.ext === ".xml") {
    return fs.readFileSync(local.path);
  }

  if (isDbEnabled()) {
    const url = await readContentUrlFromDb(eventId);
    if (url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Kunde inte hämta resultatfilen (${response.status}).`);
      }
      return Buffer.from(await response.arrayBuffer());
    }
  }

  throw new Error(`Ingen XML-fil hittades för event ${eventId}.`);
}

/** Re-parse stored Eventor/IOF XML into results (repairs empty result pages). */
export async function reindexEventXmlResults(eventId: number): Promise<{
  eventId: number;
  rowCount: number;
  deploy: DeployResult;
}> {
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new Error("Ogiltigt event-id.");
  }

  const events = await readManifest();
  const event = events.find((item) => item.id === eventId);
  if (!event) {
    throw new Error("Eventet finns inte.");
  }

  const buffer = await loadEventXmlBuffer(eventId);
  const rows = parseXmlResultsRequired(buffer, eventId);

  if (isDbEnabled()) {
    await replaceEventResultsInDb(eventId, rows);
    if (!isServerlessRuntime()) {
      const results = mergeEventResults(readLocalResultsIndex(), eventId, rows);
      writeLocalResultIndexes(results, events);
    }
    return {
      eventId,
      rowCount: rows.length,
      deploy: {
        mode: "db",
        ok: true,
        message: `Indexerade ${rows.length} starter i databasen.`,
      },
    };
  }

  if (isGitDeployConfigured()) {
    const { publishResultsDataToGitHub } = await import("./github-deploy");
    const existing = await fetchResultsIndexFromGitHub().catch(() => readLocalResultsIndex());
    const results = mergeEventResults(existing, eventId, rows);
    const peopleJson = writeLocalResultIndexes(results, events);
    const deployResult = await publishResultsDataToGitHub(
      results,
      peopleJson,
      `Indexera resultat: ${event.name} (${eventId})`,
    );
    return {
      eventId,
      rowCount: rows.length,
      deploy: {
        mode: "git",
        ok: deployResult.ok,
        message: deployResult.message,
      },
    };
  }

  const results = mergeEventResults(readLocalResultsIndex(), eventId, rows);
  writeLocalResultIndexes(results, events);
  return {
    eventId,
    rowCount: rows.length,
    deploy: {
      mode: "local",
      ok: true,
      message: `Indexerade ${rows.length} starter lokalt.`,
    },
  };
}
