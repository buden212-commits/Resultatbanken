import fs from "fs";
import path from "path";

import type { Event, Person, ResultRow } from "../types";
import { rebuildPeopleIndexFromResults } from "../rebuild-people-index";
import { applySchema, getDb } from "./client";
import { getRepoDataDir } from "./config";
import { setDocument } from "./documents";
import {
  getNextEventId,
  listEvents,
  listResults,
  replaceAllResults,
  replaceResultsForEvent,
  updateEventType as updateEventTypeInDb,
  upsertEvent,
} from "./events";
import { invalidateDbSnapshot, refreshDbSnapshot } from "./store";
import { storeContentFile } from "./content";

function readJsonFile<T>(filename: string): T {
  const filePath = path.join(getRepoDataDir(), filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

/** Push one event's JSON rows into DB and rebuild people (Node). */
export async function syncEventFromJsonIntoDb(eventId: number): Promise<Person[]> {
  const db = await getDb();
  await applySchema(db);

  const events = readJsonFile<Event[]>("manifest.json");
  const results = readJsonFile<ResultRow[]>("results-index.json");
  const event = events.find((item) => item.id === eventId);
  if (event) {
    await upsertEvent(db, event, null);
  }

  const eventResults = results.filter((row) => row.event_id === eventId);
  await replaceResultsForEvent(db, eventId, eventResults);

  const allEvents = await listEvents(db);
  const allResults = await listResults(db);
  const people = rebuildPeopleIndexFromResults(allResults, allEvents);
  await setDocument(db, "people-index", people);

  const peoplePath = path.join(getRepoDataDir(), "people-index.json");
  fs.writeFileSync(peoplePath, `${JSON.stringify(people, null, 2)}\n`, "utf-8");

  await refreshDbSnapshot();
  return people;
}

/** Full re-import of JSON indexes into DB (migration / recovery). */
export async function syncJsonIndexesIntoDb(): Promise<void> {
  const db = await getDb();
  await applySchema(db);

  const events = readJsonFile<Event[]>("manifest.json");
  const results = readJsonFile<ResultRow[]>("results-index.json");
  const people = readJsonFile<Person[]>("people-index.json");

  for (const event of events) {
    await upsertEvent(db, event, null);
  }
  await replaceAllResults(db, results);
  await setDocument(db, "people-index", people);
  invalidateDbSnapshot();
}

export async function syncResultsAndPeopleIntoDb(
  results: ResultRow[],
  events: Event[],
): Promise<Person[]> {
  const db = await getDb();
  await applySchema(db);
  await replaceAllResults(db, results);
  const people = rebuildPeopleIndexFromResults(results, events);
  await setDocument(db, "people-index", people);
  invalidateDbSnapshot();
  return people;
}

export async function createEventInDb(
  event: Event,
  file: { buffer: Buffer; filename: string },
): Promise<{ event: Event; contentUrl: string | null }> {
  const db = await getDb();
  await applySchema(db);

  const stored = await storeContentFile({
    eventId: event.id,
    buffer: file.buffer,
    filename: file.filename,
  });

  const saved: Event = {
    ...event,
    local_file: stored.localFile,
    file_size: stored.byteLength,
  };

  await upsertEvent(db, saved, stored.contentUrl);
  invalidateDbSnapshot();
  return { event: saved, contentUrl: stored.contentUrl };
}

export async function allocateEventId(): Promise<number> {
  const db = await getDb();
  await applySchema(db);
  return getNextEventId(db);
}

export async function updateEventTypeDb(eventId: number, type: string): Promise<Event> {
  const db = await getDb();
  await applySchema(db);
  const updated = await updateEventTypeInDb(db, eventId, type);
  invalidateDbSnapshot();
  return updated;
}

export async function replaceEventResultsInDb(eventId: number, rows: ResultRow[]): Promise<void> {
  const db = await getDb();
  await applySchema(db);
  await replaceResultsForEvent(db, eventId, rows);
  const events = await listEvents(db);
  const results = await listResults(db);
  const people = rebuildPeopleIndexFromResults(results, events);
  await setDocument(db, "people-index", people);
  await refreshDbSnapshot();
}

export { storeContentFile };
