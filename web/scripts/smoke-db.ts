/**
 * Smoke-test: load light DB snapshot + per-event results.
 * Usage: DATA_SOURCE=db npx tsx scripts/smoke-db.ts
 */
import fs from "fs";
import path from "path";

import {
  ensureDbSnapshot,
  ensureHeavyDataReady,
  ensureMastarnasLoaded,
  getEvents,
  getEvent,
  getResultsIndex,
  getPeopleIndex,
  getResolvedResultsForEventAsync,
} from "../src/lib/data";
import { invalidateDbSnapshot } from "../src/lib/db/store";

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
  invalidateDbSnapshot();
  const started = Date.now();
  await ensureDbSnapshot();
  const lightMs = Date.now() - started;

  const events = getEvents();
  const sample = events.find((event) => event.id === 633) ?? events[0];
  const sampleResults = sample ? await getResolvedResultsForEventAsync(sample.id) : [];
  const byId = sample ? getEvent(sample.id) : undefined;

  await ensureHeavyDataReady();
  await ensureMastarnasLoaded();
  const results = getResultsIndex();
  const people = getPeopleIndex();

  const report = {
    lightMs,
    events: events.length,
    results: results.length,
    people: people.length,
    sample: sample ? { id: sample.id, name: sample.name, rows: sampleResults.length } : null,
    getEventOk: Boolean(byId),
    ok: events.length >= 400 && Boolean(byId) && sampleResults.length >= 0,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
