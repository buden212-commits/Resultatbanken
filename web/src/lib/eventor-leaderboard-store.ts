import fs from "fs";
import path from "path";

import { isDbEnabled, isServerlessRuntime } from "./db/config";
import { applySchema, getDb } from "./db/client";
import { getDocument, setDocument } from "./db/documents";
import {
  emptyEventorLeaderboards,
  isEventorLeaderboardLockActive,
  type EventorLeaderboardRefreshLock,
  type EventorLeaderboardSnapshot,
  type EventorLeaderboardsData,
} from "./eventor-leaderboard-types";

const LOCAL_PATH = path.join(process.cwd(), "..", "data", "eventor-leaderboards.json");

function readLocal(): EventorLeaderboardsData {
  if (!fs.existsSync(LOCAL_PATH)) {
    return emptyEventorLeaderboards();
  }
  try {
    return normalize(JSON.parse(fs.readFileSync(LOCAL_PATH, "utf-8")) as EventorLeaderboardsData);
  } catch {
    return emptyEventorLeaderboards();
  }
}

function writeLocal(data: EventorLeaderboardsData): void {
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function normalizeLock(
  lock: EventorLeaderboardRefreshLock | null | undefined,
): EventorLeaderboardRefreshLock | null {
  if (!lock || !Number.isInteger(lock.year) || typeof lock.startedAt !== "string") {
    return null;
  }
  return { year: lock.year, startedAt: lock.startedAt };
}

function normalize(data: EventorLeaderboardsData | null | undefined): EventorLeaderboardsData {
  if (!data || typeof data !== "object") return emptyEventorLeaderboards();
  const byYear: Record<string, EventorLeaderboardSnapshot> = {};
  for (const [year, snapshot] of Object.entries(data.byYear ?? {})) {
    if (!snapshot || !Array.isArray(snapshot.featured)) continue;
    byYear[year] = {
      ...snapshot,
      rows: Array.isArray(snapshot.rows) ? snapshot.rows : undefined,
    };
  }
  return { byYear, refreshLock: normalizeLock(data.refreshLock) };
}

async function persist(data: EventorLeaderboardsData): Promise<EventorLeaderboardsData> {
  const normalized = normalize(data);
  if (isDbEnabled()) {
    const db = await getDb();
    await applySchema(db);
    await setDocument(db, "eventor-leaderboards", normalized);
    if (!isServerlessRuntime()) {
      try {
        writeLocal(normalized);
      } catch {
        // ignore local mirror failures
      }
    }
    return normalized;
  }

  if (isServerlessRuntime()) {
    throw new Error("Databas krävs för att spara på Vercel. Sätt DATA_SOURCE=db.");
  }
  writeLocal(normalized);
  return normalized;
}

export async function loadEventorLeaderboards(): Promise<EventorLeaderboardsData> {
  if (isDbEnabled()) {
    const db = await getDb();
    await applySchema(db);
    const data = await getDocument<EventorLeaderboardsData | null>(
      db,
      "eventor-leaderboards",
      null,
    );
    return normalize(data);
  }
  return readLocal();
}

export async function loadEventorLeaderboardYear(
  year: number,
): Promise<EventorLeaderboardSnapshot | null> {
  const data = await loadEventorLeaderboards();
  return data.byYear[String(year)] ?? null;
}

export async function saveEventorLeaderboards(
  data: EventorLeaderboardsData,
): Promise<EventorLeaderboardsData> {
  return persist(data);
}

export async function saveEventorLeaderboardSnapshot(
  snapshot: EventorLeaderboardSnapshot,
): Promise<EventorLeaderboardsData> {
  const existing = await loadEventorLeaderboards();
  const lock =
    existing.refreshLock && existing.refreshLock.year === snapshot.year
      ? null
      : existing.refreshLock;
  return persist({
    byYear: {
      ...existing.byYear,
      [String(snapshot.year)]: snapshot,
    },
    refreshLock: lock ?? null,
  });
}

export async function tryAcquireEventorLeaderboardLock(
  year: number,
): Promise<{ acquired: boolean; data: EventorLeaderboardsData }> {
  const data = await loadEventorLeaderboards();
  if (isEventorLeaderboardLockActive(data.refreshLock, year)) {
    return { acquired: false, data };
  }
  const next = await persist({
    ...data,
    refreshLock: { year, startedAt: new Date().toISOString() },
  });
  return { acquired: true, data: next };
}

export async function clearEventorLeaderboardLock(year: number): Promise<void> {
  const data = await loadEventorLeaderboards();
  if (!data.refreshLock || data.refreshLock.year !== year) return;
  await persist({ ...data, refreshLock: null });
}
