import fs from "fs";
import path from "path";

import { isDbEnabled, isServerlessRuntime } from "./db/config";
import { applySchema, getDb } from "./db/client";
import { getDocument, setDocument } from "./db/documents";
import { emptyDnsFeeTracker, normalizeDnsFeeEventWaiver, normalizeDnsFeeManualExemption, normalizeDnsFeePart, normalizeDnsFeeStatus, type DnsFeeTrackerData } from "./dns-fee-types";

const LOCAL_PATH = path.join(process.cwd(), "..", "data", "dns-fee-tracker.json");

function readLocal(): DnsFeeTrackerData {
  if (!fs.existsSync(LOCAL_PATH)) {
    return emptyDnsFeeTracker();
  }
  try {
    return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf-8")) as DnsFeeTrackerData;
  } catch {
    return emptyDnsFeeTracker();
  }
}

function writeLocal(data: DnsFeeTrackerData): void {
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function loadDnsFeeTracker(): Promise<DnsFeeTrackerData> {
  if (isDbEnabled()) {
    const db = await getDb();
    await applySchema(db);
    const data = await getDocument<DnsFeeTrackerData | null>(db, "dns-fee-tracker", null);
    if (!data || !Array.isArray(data.rows)) {
      return emptyDnsFeeTracker();
    }
    return normalizeTracker(data);
  }
  return normalizeTracker(readLocal());
}

function normalizeTracker(data: DnsFeeTrackerData): DnsFeeTrackerData {
  return {
    year: data.year ?? 2026,
    importedAt: data.importedAt ?? null,
    rows: (data.rows ?? []).map((row) => ({
      ...row,
      status: normalizeDnsFeeStatus(row.status),
      inSweden: row.inSweden !== false,
      fees: Array.isArray(row.fees)
        ? row.fees.map(normalizeDnsFeePart).filter((part): part is NonNullable<typeof part> => Boolean(part))
        : null,
      dnsReason:
        typeof row.dnsReason === "string" && row.dnsReason.trim()
          ? row.dnsReason.trim()
          : null,
      dnsReasonAt:
        typeof row.dnsReasonAt === "string" && row.dnsReasonAt.trim()
          ? row.dnsReasonAt.trim()
          : null,
    })),
    members: Array.isArray(data.members)
      ? data.members
          .filter((m) => m && typeof m.personId === "string")
          .map((m) => ({
            personId: String(m.personId),
            personName: String(m.personName || `Person ${m.personId}`),
            email:
              typeof m.email === "string" && m.email.includes("@") ? m.email.trim() : null,
          }))
      : [],
    exemptEventIds: Array.isArray(data.exemptEventIds) ? data.exemptEventIds.map(String) : [],
    removedEventIds: Array.isArray(data.removedEventIds) ? data.removedEventIds.map(String) : [],
    eventWaivers: Array.isArray(data.eventWaivers)
      ? data.eventWaivers
          .map(normalizeDnsFeeEventWaiver)
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [],
    exemptFeeNames: Array.isArray(data.exemptFeeNames)
      ? [...new Set(data.exemptFeeNames.map((name) => String(name).trim()).filter(Boolean))].sort(
          (a, b) => a.localeCompare(b, "sv"),
        )
      : [],
    manualExemptions: Array.isArray(data.manualExemptions)
      ? data.manualExemptions
          .map(normalizeDnsFeeManualExemption)
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [],
  };
}

export async function saveDnsFeeTracker(data: DnsFeeTrackerData): Promise<void> {
  if (isDbEnabled()) {
    const db = await getDb();
    await applySchema(db);
    await setDocument(db, "dns-fee-tracker", data);
    if (!isServerlessRuntime()) {
      try {
        writeLocal(data);
      } catch {
        // ignore local mirror failures
      }
    }
    return;
  }
  if (isServerlessRuntime()) {
    throw new Error("Databas krävs för att spara på Vercel. Sätt DATA_SOURCE=db.");
  }
  writeLocal(data);
}
