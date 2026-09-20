import path from "path";

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

export function isBlobEnabled(): boolean {
  return Boolean(env("BLOB_READ_WRITE_TOKEN"));
}
