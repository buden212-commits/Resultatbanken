import fs from "fs";
import path from "path";

import { isDbEnabled, isServerlessRuntime } from "./db/config";
import { applySchema, getDb } from "./db/client";
import { getDocument, setDocument } from "./db/documents";
import {
  emptyEventorLeaderboards,
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
  return { byYear };
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

export async function saveEventorLeaderboardSnapshot(
  snapshot: EventorLeaderboardSnapshot,
): Promise<EventorLeaderboardsData> {
  const existing = await loadEventorLeaderboards();
  const next: EventorLeaderboardsData = {
    byYear: {
      ...existing.byYear,
      [String(snapshot.year)]: snapshot,
    },
  };

  if (isDbEnabled()) {
    const db = await getDb();
    await applySchema(db);
    await setDocument(db, "eventor-leaderboards", next);
    if (!isServerlessRuntime()) {
      try {
        writeLocal(next);
      } catch {
        // ignore local mirror failures
      }
    }
    return next;
  }

  if (isServerlessRuntime()) {
    throw new Error("Databas krävs för att spara på Vercel. Sätt DATA_SOURCE=db.");
  }
  writeLocal(next);
  return next;
}
