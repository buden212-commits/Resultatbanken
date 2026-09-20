/**
 * Verify migrated DB matches JSON counts.
 * Usage (from web/): npx tsx scripts/verify-db.ts
 */
import fs from "fs";
import path from "path";

import { applySchema, getDb, resetDbForTests } from "../src/lib/db/client";
import { countEvents, countResults, getEventById, listResultsForEvent } from "../src/lib/db/events";
import { getDocument } from "../src/lib/db/documents";
import { loadDbSnapshot } from "../src/lib/db/store";
import type { Person } from "../src/lib/types";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim().replace(/^\uFEFF/, "");
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  process.env.DATA_SOURCE = process.env.DATA_SOURCE || "db";

  await resetDbForTests();
  const db = await getDb();
  await applySchema(db);

  const events = await countEvents(db);
  const results = await countResults(db);
  const people = await getDocument<Person[]>(db, "people-index", []);
  const event1 = await getEventById(db, 1);
  const results1 = await listResultsForEvent(db, 1);
  const snapshot = await loadDbSnapshot(db);

  const report = {
    kind: db.kind,
    events,
    results,
    people: people.length,
    event1Name: event1?.name ?? null,
    event1Results: results1.length,
    snapshotEvents: snapshot.events.length,
    snapshotResults: snapshot.results.length,
    mastarnasSeasons: Array.isArray((snapshot.mastarnas as { seasons?: unknown[] } | null)?.seasons)
      ? (snapshot.mastarnas as { seasons: unknown[] }).seasons.length
      : 0,
    ok:
      db.kind === "postgres" &&
      events === 422 &&
      results === 8162 &&
      people.length === 2050 &&
      Boolean(event1),
  };

  console.log(JSON.stringify(report, null, 2));
  await db.close();
  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
