import path from "path";
import os from "os";

function env(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) {
    return undefined;
  }
  return raw.trim().replace(/^["']|["']$/g, "");
}

/** Prefer DB when DATA_SOURCE=db or a Postgres URL is set. */
export function isDbEnabled(): boolean {
  const source = (env("DATA_SOURCE") ?? "").toLowerCase();
  if (source === "json" || source === "files") {
    return false;
  }
  if (source === "db") {
    return true;
  }
  return Boolean(getDatabaseUrl());
}

/** Vercel injects POSTGRES_URL; we also accept DATABASE_URL / POSTGRES_PRISMA_URL. */
export function getDatabaseUrl(): string | null {
  const candidates = [env("DATABASE_URL"), env("POSTGRES_URL"), env("POSTGRES_PRISMA_URL")];
  for (const value of candidates) {
    if (value) {
      return value;
    }
  }
  return null;
}

export function getPgliteDataDir(): string {
  const configured = env("PGLITE_DATA_DIR");
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), "..", ".data", "pglite");
}

export function getRepoDataDir(): string {
  return path.join(process.cwd(), "..", "data");
}

/** True on Vercel / Lambda where the app bundle FS is read-only. */
export function isServerlessRuntime(): boolean {
  return Boolean(env("VERCEL") || env("AWS_LAMBDA_FUNCTION_NAME"));
}

/** Writable content directory (repo data/ locally, /tmp on serverless). */
export function getWritableContentDir(): string {
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), "resultatbanken", "content");
  }
  return path.join(getRepoDataDir(), "content");
}

/** Blob token (local) or store id (Vercel OIDC). */
export function isBlobEnabled(): boolean {
  return Boolean(env("BLOB_READ_WRITE_TOKEN") || env("BLOB_STORE_ID"));
}
