/**
 * Migrate data/*.json into Postgres (DATABASE_URL) or local PGlite (.data/pglite).
 *
 * Usage (from web/):
 *   npx tsx scripts/migrate-to-db.ts
 */
import fs from "fs";
import path from "path";

import { applySchema, getDb, resetDbForTests } from "../src/lib/db/client";
import { getDatabaseUrl, getRepoDataDir } from "../src/lib/db/config";
import { setDocument } from "../src/lib/db/documents";
import { countEvents, countResults, replaceAllResults, upsertEvent } from "../src/lib/db/events";
import type { Event, Person, ResultRow } from "../src/lib/types";

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

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function redactUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ":****@");
}

async function main(): Promise<void> {
  loadEnvLocal();
  process.env.DATA_SOURCE = process.env.DATA_SOURCE || "db";

  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error("Saknar POSTGRES_URL / DATABASE_URL i .env.local — avbryter (vill inte skriva till PGlite av misstag).");
    process.exit(1);
  }
  console.log(`Ansluter till Postgres: ${redactUrl(dbUrl)}`);

  const dataDir = getRepoDataDir();
  const events = readJson<Event[]>(path.join(dataDir, "manifest.json"), []);
  const results = readJson<ResultRow[]>(path.join(dataDir, "results-index.json"), []);
  const people = readJson<Person[]>(path.join(dataDir, "people-index.json"), []);
  const personAliases = readJson(path.join(dataDir, "person-aliases.json"), []);
  const typeAliases = readJson(path.join(dataDir, "type-aliases.json"), []);
  const statsExclusions = readJson(path.join(dataDir, "stats-exclusions.json"), [] as number[]);
  const mastarnas = readJson(path.join(dataDir, "mastarnas.json"), null);

  console.log(`Läser från ${dataDir}`);
  console.log(`  events=${events.length}, results=${results.length}, people=${people.length}`);

  await resetDbForTests();
  const db = await getDb();
  console.log(`DB-klient: ${db.kind}`);
  if (db.kind !== "postgres") {
    console.error("Förväntade postgres-klient. Avbryter.");
    process.exit(1);
  }
  await applySchema(db);

  console.log("Rensar befintliga tabeller...");
  await db.exec("DELETE FROM results");
  await db.exec("DELETE FROM events");
  await db.exec("DELETE FROM app_documents");

  console.log("Skriver events...");
  for (const event of events) {
    await upsertEvent(db, event, null);
  }

  console.log("Skriver results...");
  await replaceAllResults(db, results);

  console.log("Skriver dokument...");
  await setDocument(db, "people-index", people);
  await setDocument(db, "person-aliases", personAliases);
  await setDocument(db, "type-aliases", typeAliases);
  await setDocument(db, "stats-exclusions", statsExclusions);
  if (mastarnas) {
    await setDocument(db, "mastarnas", mastarnas);
  }

  const eventCount = await countEvents(db);
  const resultCount = await countResults(db);
  console.log(`Klart. Neon har events=${eventCount}, results=${resultCount}`);
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
