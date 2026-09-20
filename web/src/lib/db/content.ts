import fs from "fs";
import path from "path";

import { put } from "@vercel/blob";

import {
  getRepoDataDir,
  getWritableContentDir,
  isBlobEnabled,
  isServerlessRuntime,
} from "./config";

export type StoredContent = {
  storedName: string;
  localFile: string;
  contentUrl: string | null;
  byteLength: number;
};

/** Store upload: Blob on Vercel; local data/content when writable. */
export async function storeContentFile(options: {
  eventId: number;
  buffer: Buffer;
  filename: string;
}): Promise<StoredContent> {
  const ext = path.extname(options.filename).toLowerCase() || ".bin";
  const storedName = `${options.eventId}${ext}`;
  const byteLength = options.buffer.byteLength;

  if (isServerlessRuntime() && !isBlobEnabled()) {
    throw new Error(
      "Vercel Blob är inte konfigurerat. Koppla Blob-store till projektet (BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN).",
    );
  }

  const dir = getWritableContentDir();
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
  const dirs = [getWritableContentDir(), path.join(getRepoDataDir(), "content")];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const matches = fs
      .readdirSync(dir)
      .filter((file) => file.startsWith(`${eventId}.`))
      .sort();
    if (matches.length === 0) {
      continue;
    }
    const filename = matches[0];
    return {
      path: path.join(dir, filename),
      ext: path.extname(filename).toLowerCase(),
    };
  }
  return null;
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
