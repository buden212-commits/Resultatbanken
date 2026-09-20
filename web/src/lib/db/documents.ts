import type { DbClient } from "./client";

export type AppDocumentKey =
  | "people-index"
  | "person-aliases"
  | "type-aliases"
  | "stats-exclusions"
  | "mastarnas"
  | "dns-fee-tracker";

export async function getDocument<T>(
  db: DbClient,
  key: AppDocumentKey,
  fallback: T,
): Promise<T> {
  const rows = await db.query<{ data: T | string }>(
    "SELECT data FROM app_documents WHERE key = ?",
    [key],
  );
  if (rows.length === 0) {
    return fallback;
  }
  const data = rows[0].data;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return fallback;
    }
  }
  return (data ?? fallback) as T;
}

export async function setDocument<T>(db: DbClient, key: AppDocumentKey, data: T): Promise<void> {
  // postgres.js accepts JS objects for jsonb; PGlite prefers a JSON string.
  const payload = db.kind === "pglite" ? JSON.stringify(data) : data;
  await db.query(
    `INSERT INTO app_documents (key, data, updated_at)
     VALUES (?, ?::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
       SET data = EXCLUDED.data, updated_at = NOW()`,
    [key, payload],
  );
}
