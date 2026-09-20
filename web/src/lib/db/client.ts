import fs from "fs";
import path from "path";

import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

import { getDatabaseUrl, getPgliteDataDir } from "./config";

export type SqlQueryResult = Record<string, unknown>[];

export type DbClient = {
  kind: "postgres" | "pglite";
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ) => Promise<T[]>;
  exec: (text: string) => Promise<void>;
  close: () => Promise<void>;
};

const globalForDb = globalThis as typeof globalThis & {
  __rbDbClient?: DbClient;
  __rbDbInit?: Promise<DbClient>;
};

function convertPositionalParams(text: string): string {
  let index = 0;
  return text.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

async function createPostgresClient(url: string): Promise<DbClient> {
  const sql = postgres(url, { max: 5, idle_timeout: 20 });
  return {
    kind: "postgres",
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: unknown[] = [],
    ) {
      const converted = convertPositionalParams(text);
      return (await sql.unsafe(converted, params as never[])) as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text);
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

async function createPgliteClient(dataDir: string): Promise<DbClient> {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  return {
    kind: "pglite",
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: unknown[] = [],
    ) {
      const converted = convertPositionalParams(text);
      const result = await db.query(converted, params);
      return result.rows as T[];
    },
    async exec(text: string) {
      await db.exec(text);
    },
    async close() {
      await db.close();
    },
  };
}

export async function getDb(): Promise<DbClient> {
  if (globalForDb.__rbDbClient) {
    return globalForDb.__rbDbClient;
  }
  if (!globalForDb.__rbDbInit) {
    globalForDb.__rbDbInit = (async () => {
      const url = getDatabaseUrl();
      const client = url
        ? await createPostgresClient(url)
        : await createPgliteClient(getPgliteDataDir());
      globalForDb.__rbDbClient = client;
      return client;
    })();
  }
  return globalForDb.__rbDbInit;
}

export async function resetDbForTests(): Promise<void> {
  if (globalForDb.__rbDbClient) {
    await globalForDb.__rbDbClient.close();
  }
  globalForDb.__rbDbClient = undefined;
  globalForDb.__rbDbInit = undefined;
}

export async function applySchema(client?: DbClient): Promise<void> {
  const db = client ?? (await getDb());
  const schemaPath = path.join(process.cwd(), "src", "lib", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  await db.exec(schema);
}
