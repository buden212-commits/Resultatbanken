/**
 * Re-upload JSON documents only (people, aliases, mastarnas, …) to Postgres.
 */
import fs from "fs";
import path from "path";

import { applySchema, getDb, resetDbForTests } from "../src/lib/db/client";
import { getRepoDataDir } from "../src/lib/db/config";
import { getDocument, setDocument } from "../src/lib/db/documents";
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

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

async function main(): Promise<void> {
  loadEnvLocal();
  process.env.DATA_SOURCE = "db";

  const dataDir = getRepoDataDir();
  const people = readJson<Person[]>(path.join(dataDir, "people-index.json"), []);
  const personAliases = readJson(path.join(dataDir, "person-aliases.json"), []);
  const typeAliases = readJson(path.join(dataDir, "type-aliases.json"), []);
  const statsExclusions = readJson(path.join(dataDir, "stats-exclusions.json"), [] as number[]);
  const mastarnas = readJson(path.join(dataDir, "mastarnas.json"), null);

  await resetDbForTests();
  const db = await getDb();
  if (db.kind !== "postgres") {
    throw new Error("Förväntade postgres");
  }
  await applySchema(db);

  console.log("Skriver dokument...");
  await setDocument(db, "people-index", people);
  await setDocument(db, "person-aliases", personAliases);
  await setDocument(db, "type-aliases", typeAliases);
  await setDocument(db, "stats-exclusions", statsExclusions);
  if (mastarnas) {
    await setDocument(db, "mastarnas", mastarnas);
  }

  const peopleCheck = await getDocument<Person[]>(db, "people-index", []);
  const mastarnasCheck = await getDocument<{ seasons?: unknown[] } | null>(db, "mastarnas", null);
  console.log(
    JSON.stringify(
      {
        people: Array.isArray(peopleCheck) ? peopleCheck.length : typeof peopleCheck,
        mastarnasSeasons: mastarnasCheck?.seasons?.length ?? 0,
        ok: Array.isArray(peopleCheck) && peopleCheck.length === 2050,
      },
      null,
      2,
    ),
  );
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
