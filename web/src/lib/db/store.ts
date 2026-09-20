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

/** Light cache — safe to warm on every request (no multi‑MB payloads). */
export type DbSnapshot = {
  events: Event[];
  personAliases: unknown;
  typeAliases: unknown;
  statsExclusions: unknown;
};

const globalForCache = globalThis as typeof globalThis & {
  __rbDbSnapshot?: DbSnapshot | null;
  __rbDbSnapshotLoading?: Promise<DbSnapshot> | null;
  __rbResultsCache?: ResultRow[] | null;
  __rbResultsLoading?: Promise<ResultRow[]> | null;
  __rbPeopleCache?: Person[] | null;
  __rbMastarnasCache?: unknown;
};

export function useDbData(): boolean {
  return isDbEnabled();
}

export async function loadDbSnapshot(client?: DbClient): Promise<DbSnapshot> {
  const db = client ?? (await getDb());
  await applySchema(db);

  const [events, personAliases, typeAliases, statsExclusions] = await Promise.all([
    listEvents(db),
    getDocument(db, "person-aliases", []),
    getDocument(db, "type-aliases", []),
    getDocument(db, "stats-exclusions", []),
  ]);

  return {
    events,
    personAliases,
    typeAliases,
    statsExclusions,
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
    globalForCache.__rbDbSnapshotLoading = loadDbSnapshot()
      .then((snapshot) => {
        globalForCache.__rbDbSnapshot = snapshot;
        globalForCache.__rbDbSnapshotLoading = null;
        return snapshot;
      })
      .catch((error) => {
        globalForCache.__rbDbSnapshotLoading = null;
        throw error;
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
  globalForCache.__rbResultsCache = null;
  globalForCache.__rbResultsLoading = null;
  globalForCache.__rbPeopleCache = null;
  globalForCache.__rbMastarnasCache = undefined;
  const snapshot = await loadDbSnapshot();
  globalForCache.__rbDbSnapshot = snapshot;
  return snapshot;
}

export function invalidateDbSnapshot(): void {
  globalForCache.__rbDbSnapshot = null;
  globalForCache.__rbDbSnapshotLoading = null;
  globalForCache.__rbResultsCache = null;
  globalForCache.__rbResultsLoading = null;
  globalForCache.__rbPeopleCache = null;
  globalForCache.__rbMastarnasCache = undefined;
}

export async function ensureResultsLoaded(): Promise<ResultRow[]> {
  if (!isDbEnabled()) {
    return [];
  }
  if (globalForCache.__rbResultsCache) {
    return globalForCache.__rbResultsCache;
  }
  if (!globalForCache.__rbResultsLoading) {
    globalForCache.__rbResultsLoading = (async () => {
      const db = await getDb();
      await applySchema(db);
      const rows = await listResults(db);
      globalForCache.__rbResultsCache = rows;
      globalForCache.__rbResultsLoading = null;
      return rows;
    })();
  }
  return globalForCache.__rbResultsLoading;
}

export async function ensurePeopleLoaded(): Promise<Person[]> {
  if (!isDbEnabled()) {
    return [];
  }
  if (globalForCache.__rbPeopleCache) {
    return globalForCache.__rbPeopleCache;
  }
  const db = await getDb();
  const people = await getDocument<Person[]>(db, "people-index", []);
  globalForCache.__rbPeopleCache = people;
  return people;
}

export async function ensureMastarnasLoaded(): Promise<unknown> {
  if (!isDbEnabled()) {
    return null;
  }
  if (globalForCache.__rbMastarnasCache !== undefined) {
    return globalForCache.__rbMastarnasCache;
  }
  const db = await getDb();
  const data = await getDocument(db, "mastarnas", null);
  globalForCache.__rbMastarnasCache = data;
  return data;
}

export function getResultsCacheSync(): ResultRow[] | null {
  return globalForCache.__rbResultsCache ?? null;
}

export function getPeopleCacheSync(): Person[] | null {
  return globalForCache.__rbPeopleCache ?? null;
}

export function getMastarnasCacheSync(): unknown {
  return globalForCache.__rbMastarnasCache;
}

export async function readEventsFromDb(): Promise<Event[]> {
  await ensureDbSnapshot();
  return requireDbSnapshot().events;
}

export async function readResultsFromDb(): Promise<ResultRow[]> {
  return ensureResultsLoaded();
}

export async function readPeopleFromDb(): Promise<Person[]> {
  return ensurePeopleLoaded();
}

export async function readEventFromDb(id: number): Promise<Event | undefined> {
  const snapshot = await ensureDbSnapshot();
  if (snapshot) {
    return snapshot.events.find((event) => event.id === id);
  }
  const db = await getDb();
  return getEventById(db, id);
}

/** Always query one event — avoids loading the full results index. */
export async function readResultsForEventFromDb(eventId: number): Promise<ResultRow[]> {
  const db = await getDb();
  await applySchema(db);
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
  // Keep MM in-memory after write so same-request reads stay current.
  if (key === "mastarnas") {
    globalForCache.__rbMastarnasCache = data;
  }
}
