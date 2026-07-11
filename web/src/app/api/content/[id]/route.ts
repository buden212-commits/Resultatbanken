import fs from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { findContentFile } from "@/lib/data";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".rtf": "application/rtf",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const eventId = Number(id);
  const file = findContentFile(eventId);

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const body = fs.readFileSync(file.path);
  const contentType = MIME[file.ext] ?? "application/octet-stream";
  const filename = path.basename(file.path);

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": file.ext === ".pdf" ? "inline" : `inline; filename="${filename}"`,
    },
  });
}
