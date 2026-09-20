import fs from "fs";
import path from "path";

import { put } from "@vercel/blob";

import { getRepoDataDir, isBlobEnabled } from "./config";

export type StoredContent = {
  storedName: string;
  localFile: string;
  contentUrl: string | null;
  byteLength: number;
};

function contentDir(): string {
  return path.join(getRepoDataDir(), "content");
}

/** Always keeps a local copy (for Python parsers). Also uploads to Blob when configured. */
export async function storeContentFile(options: {
  eventId: number;
  buffer: Buffer;
  filename: string;
}): Promise<StoredContent> {
  const ext = path.extname(options.filename).toLowerCase() || ".bin";
  const storedName = `${options.eventId}${ext}`;
  const byteLength = options.buffer.byteLength;

  const dir = contentDir();
  fs.mkdirSync(dir, { recursive: true });
  const storedPath = path.join(dir, storedName);
  fs.writeFileSync(storedPath, options.buffer);

  let contentUrl: string | null = null;
  if (isBlobEnabled()) {
    const blob = await put(`content/${storedName}`, options.buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: guessMime(ext),
    });
    contentUrl = blob.url;
  }

  return {
    storedName,
    localFile: `content/${storedName}`,
    contentUrl,
    byteLength,
  };
}

export function findLocalContentFile(eventId: number): { path: string; ext: string } | null {
  const dir = contentDir();
  if (!fs.existsSync(dir)) {
    return null;
  }
  const matches = fs
    .readdirSync(dir)
    .filter((file) => file.startsWith(`${eventId}.`))
    .sort();
  if (matches.length === 0) {
    return null;
  }
  const filename = matches[0];
  return {
    path: path.join(dir, filename),
    ext: path.extname(filename).toLowerCase(),
  };
}

function guessMime(ext: string): string {
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".htm": "text/html",
    ".txt": "text/plain",
    ".xml": "application/xml",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
  };
  return map[ext] ?? "application/octet-stream";
}
