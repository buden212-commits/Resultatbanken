import type { Event, Person, ResultRow } from "../types";
import { applySchema, getDb, type DbClient } from "./client";
import { isDbEnabled } from "./config";
import { getDocument, setDocument, type AppDocumentKey } from "./documents";
import {
  getEventById,
  getEventContentUrl,
  listEvents,
  listResults,
  listResultsForEvent,
} from "./events";

export type DbSnapshot = {
  events: Event[];
  results: ResultRow[];
  people: Person[];
  personAliases: unknown;
  typeAliases: unknown;
  statsExclusions: unknown;
  mastarnas: unknown;
};

const globalForCache = globalThis as typeof globalThis & {
  __rbDbSnapshot?: DbSnapshot | null;
  __rbDbSnapshotLoading?: Promise<DbSnapshot> | null;
};

export function useDbData(): boolean {
  return isDbEnabled();
}

export async function loadDbSnapshot(client?: DbClient): Promise<DbSnapshot> {
  const db = client ?? (await getDb());
  await applySchema(db);

  const [events, results, people, personAliases, typeAliases, statsExclusions, mastarnas] =
    await Promise.all([
      listEvents(db),
      listResults(db),
      getDocument<Person[]>(db, "people-index", []),
      getDocument(db, "person-aliases", []),
      getDocument(db, "type-aliases", []),
      getDocument(db, "stats-exclusions", []),
      getDocument(db, "mastarnas", null),
    ]);

  return {
    events,
    results,
    people,
    personAliases,
    typeAliases,
    statsExclusions,
    mastarnas,
  };
}

export async function ensureDbSnapshot(): Promise<DbSnapshot | null> {
  if (!isDbEnabled()) {
    return null;
  }
  if (globalForCache.__rbDbSnapshot) {
    return globalForCache.__rbDbSnapshot;
  }
  if (!globalForCache.__rbDbSnapshotLoading) {
    globalForCache.__rbDbSnapshotLoading = loadDbSnapshot().then((snapshot) => {
      globalForCache.__rbDbSnapshot = snapshot;
      globalForCache.__rbDbSnapshotLoading = null;
      return snapshot;
    });
  }
  return globalForCache.__rbDbSnapshotLoading;
}

export function getDbSnapshotSync(): DbSnapshot | null {
  if (!isDbEnabled()) {
    return null;
  }
  return globalForCache.__rbDbSnapshot ?? null;
}

export function requireDbSnapshot(): DbSnapshot {
  const snapshot = getDbSnapshotSync();
  if (!snapshot) {
    throw new Error(
      "Databasen är aktiverad men cachen är inte laddad. Anropa ensureDbSnapshot() först.",
    );
  }
  return snapshot;
}

export async function refreshDbSnapshot(): Promise<DbSnapshot> {
  globalForCache.__rbDbSnapshot = null;
  globalForCache.__rbDbSnapshotLoading = null;
  const snapshot = await loadDbSnapshot();
  globalForCache.__rbDbSnapshot = snapshot;
  return snapshot;
}

export function invalidateDbSnapshot(): void {
  globalForCache.__rbDbSnapshot = null;
  globalForCache.__rbDbSnapshotLoading = null;
}

export async function readEventsFromDb(): Promise<Event[]> {
  await ensureDbSnapshot();
  return requireDbSnapshot().events;
}

export async function readResultsFromDb(): Promise<ResultRow[]> {
  await ensureDbSnapshot();
  return requireDbSnapshot().results;
}

export async function readPeopleFromDb(): Promise<Person[]> {
  await ensureDbSnapshot();
  return requireDbSnapshot().people;
}

export async function readEventFromDb(id: number): Promise<Event | undefined> {
  const snapshot = await ensureDbSnapshot();
  if (snapshot) {
    return snapshot.events.find((event) => event.id === id);
  }
  const db = await getDb();
  return getEventById(db, id);
}

export async function readResultsForEventFromDb(eventId: number): Promise<ResultRow[]> {
  const snapshot = await ensureDbSnapshot();
  if (snapshot) {
    return snapshot.results.filter((row) => row.event_id === eventId);
  }
  const db = await getDb();
  return listResultsForEvent(db, eventId);
}

export async function readContentUrlFromDb(eventId: number): Promise<string | null> {
  const db = await getDb();
  return getEventContentUrl(db, eventId);
}

export async function writeDocumentToDb(key: AppDocumentKey, data: unknown): Promise<void> {
  const db = await getDb();
  await setDocument(db, key, data);
  invalidateDbSnapshot();
}
