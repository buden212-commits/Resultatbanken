import { spawn } from "child_process";
import fs from "fs";
import path from "path";

import {
  fetchManifestFromGitHub,
  isGitDeployConfigured,
  publishEventToGitHub,
  publishManifestToGitHub,
} from "./github-deploy";
import type { Event } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const CONTENT_DIR = path.join(DATA_DIR, "content");
const MANIFEST_PATH = path.join(DATA_DIR, "manifest.json");
const SCRIPTS_DIR = path.join(process.cwd(), "..", "scripts");

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".html",
  ".htm",
  ".txt",
  ".xls",
  ".xlsx",
  ".ods",
  ".doc",
  ".docx",
  ".rtf",
  ".jpeg",
  ".jpg",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".htm": "text/html",
  ".txt": "text/plain",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
};

export type CreateEventInput = {
  name: string;
  type: string;
  date: string;
  organizer: string;
  location: string;
  free_text: string;
};

export type DeployResult = {
  mode: "local" | "git";
  ok: boolean;
  message: string;
};

export type CreateEventResult = {
  event: Event;
  deploy: DeployResult;
};

function readManifestLocal(): Event[] {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as Event[];
}

function writeManifestLocal(events: Event[]): void {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(events, null, 2)}\n`, "utf-8");
}

async function readManifest(): Promise<Event[]> {
  if (isGitDeployConfigured()) {
    return fetchManifestFromGitHub();
  }
  return readManifestLocal();
}

export async function getNextEventId(): Promise<number> {
  const events = await readManifest();
  return Math.max(0, ...events.map((event) => event.id)) + 1;
}

export function getEventTypes(): string[] {
  const types = new Set<string>();
  for (const event of readManifestLocal()) {
    const value = event.type?.trim();
    if (value) {
      types.add(value);
    }
  }
  return [...types].sort((a, b) => a.localeCompare(b, "sv"));
}

export function getDeployMode(): "local" | "git" {
  return isGitDeployConfigured() ? "git" : "local";
}

function resolveExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function validateInput(input: CreateEventInput, ext: string): void {
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Filtypen ${ext || "(saknas)"} stöds inte.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Ogiltigt datum — använd formatet ÅÅÅÅ-MM-DD.");
  }

  if (!input.name.trim()) {
    throw new Error("Träningsnamn krävs.");
  }
}

function buildEvent(
  id: number,
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string; storedName: string },
  ext: string,
): Event {
  return {
    id,
    name: input.name.trim(),
    type: input.type.trim(),
    date: input.date,
    organizer: input.organizer.trim(),
    location: input.location.trim(),
    free_text: input.free_text.trim(),
    result_file: file.filename,
    file_size: file.buffer.byteLength,
    file_type: MIME_BY_EXT[ext] ?? "application/octet-stream",
    source_url: "",
    local_file: `content/${file.storedName}`,
    downloaded_at: new Date().toISOString(),
  };
}

function runPythonScript(scriptName: string, args: string[] = []): Promise<{ ok: boolean; message: string }> {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const candidates = process.platform === "win32" ? ["py", "python3", "python"] : ["python3", "python"];

  return new Promise((resolve) => {
    let index = 0;

    function tryNext(): void {
      if (index >= candidates.length) {
        resolve({
          ok: false,
          message: "Python hittades inte — kör scripts/extract_participants.py och scripts/rebuild_index.py manuellt.",
        });
        return;
      }

      const command = candidates[index];
      index += 1;

      const child = spawn(command, [scriptPath, ...args], {
        cwd: path.join(process.cwd(), ".."),
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });

      let output = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });

      child.on("error", () => {
        tryNext();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ ok: true, message: output.trim() || "Index uppdaterat." });
          return;
        }
        tryNext();
      });
    }

    tryNext();
  });
}

async function reindexEventLocally(eventId: number): Promise<DeployResult> {
  const extract = await runPythonScript("extract_participants.py", ["--event-id", String(eventId)]);
  if (!extract.ok) {
    return { mode: "local", ok: false, message: extract.message };
  }

  const rebuild = await runPythonScript("rebuild_index.py");
  if (!rebuild.ok) {
    return { mode: "local", ok: false, message: rebuild.message };
  }

  return {
    mode: "local",
    ok: true,
    message: [extract.message, rebuild.message].filter(Boolean).join(" "),
  };
}

async function createEventLocally(
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string },
): Promise<CreateEventResult> {
  const ext = resolveExtension(file.filename);
  validateInput(input, ext);

  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const id = await getNextEventId();
  const storedName = `${id}${ext}`;
  const storedPath = path.join(CONTENT_DIR, storedName);

  fs.writeFileSync(storedPath, file.buffer);

  const event = buildEvent(id, input, { ...file, storedName }, ext);

  const manifest = readManifestLocal();
  manifest.push(event);
  writeManifestLocal(manifest);

  const deploy = await reindexEventLocally(id);

  return { event, deploy };
}

async function createEventViaGit(
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string },
): Promise<CreateEventResult> {
  const ext = resolveExtension(file.filename);
  validateInput(input, ext);

  const id = await getNextEventId();
  const storedName = `${id}${ext}`;
  const event = buildEvent(id, input, { ...file, storedName }, ext);

  const deployResult = await publishEventToGitHub(event, { buffer: file.buffer, storedName });

  return {
    event,
    deploy: {
      mode: "git",
      ok: deployResult.ok,
      message: deployResult.message,
    },
  };
}

export async function createEvent(
  input: CreateEventInput,
  file: { buffer: Buffer; filename: string },
): Promise<CreateEventResult> {
  if (isGitDeployConfigured()) {
    return createEventViaGit(input, file);
  }
  return createEventLocally(input, file);
}

export type UpdateEventTypeResult = {
  event: Event;
  deploy: DeployResult;
};

export async function updateEventType(eventId: number, type: string): Promise<UpdateEventTypeResult> {
  const trimmed = type.trim();
  if (!trimmed) {
    throw new Error("Typ krävs.");
  }

  if (isGitDeployConfigured()) {
    const manifest = await fetchManifestFromGitHub();
    const index = manifest.findIndex((event) => event.id === eventId);
    if (index === -1) {
      throw new Error("Eventet finns inte.");
    }

    const updated = { ...manifest[index], type: trimmed };
    manifest[index] = updated;

    const deployResult = await publishManifestToGitHub(
      manifest,
      `Uppdatera typ: ${trimmed} (event ${eventId})`,
    );

    return {
      event: updated,
      deploy: {
        mode: "git",
        ok: deployResult.ok,
        message: deployResult.message,
      },
    };
  }

  const manifest = readManifestLocal();
  const index = manifest.findIndex((event) => event.id === eventId);
  if (index === -1) {
    throw new Error("Eventet finns inte.");
  }

  const updated = { ...manifest[index], type: trimmed };
  manifest[index] = updated;
  writeManifestLocal(manifest);

  const rebuild = await runPythonScript("rebuild_index.py");
  return {
    event: updated,
    deploy: {
      mode: "local",
      ok: rebuild.ok,
      message: rebuild.ok ? "Typ sparad och index uppdaterat." : rebuild.message,
    },
  };
}
