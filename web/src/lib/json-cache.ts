import fs from "fs";

type CacheEntry = { mtime: number; value: unknown };

const globalForCache = globalThis as typeof globalThis & {
  __rbJsonCache?: Map<string, CacheEntry>;
};

function caches(): Map<string, CacheEntry> {
  if (!globalForCache.__rbJsonCache) {
    globalForCache.__rbJsonCache = new Map();
  }
  return globalForCache.__rbJsonCache;
}

export function readCachedJson<T>(filePath: string): T {
  const mtime = fs.statSync(filePath).mtimeMs;
  const existing = caches().get(filePath);
  if (existing && existing.mtime === mtime) {
    return existing.value as T;
  }
  const value = JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  caches().set(filePath, { mtime, value });
  return value;
}

export function readCachedJsonIfExists<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return readCachedJson<T>(filePath);
}
