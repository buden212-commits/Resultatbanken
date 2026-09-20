import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { applySchema, getDb, resetDbForTests } from "./client";
import { setDocument, getDocument } from "./documents";
import {
  countEvents,
  countResults,
  getNextEventId,
  listEvents,
  listResults,
  replaceAllResults,
  replaceResultsForEvent,
  updateEventType,
  upsertEvent,
} from "./events";
import { storeContentFile, findLocalContentFile } from "./content";
import { loadDbSnapshot, invalidateDbSnapshot } from "./store";
import type { Event, ResultRow } from "../types";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-db-"));
const pgliteDir = path.join(tempRoot, "pglite");
const dataDir = path.join(tempRoot, "data");

function sampleEvent(id: number, overrides: Partial<Event> = {}): Event {
  return {
    id,
    name: `Test ${id}`,
    type: "KM",
    date: "2024-05-01",
    organizer: "IFK Mora OK",
    location: "Mora",
    free_text: "",
    result_file: `${id}.xml`,
    file_size: 10,
    file_type: "application/xml",
    source_url: "",
    local_file: `content/${id}.xml`,
    downloaded_at: "2024-05-01T12:00:00Z",
    ...overrides,
  };
}

function sampleResult(eventId: number, personKey: string): ResultRow {
  return {
    event_id: eventId,
    person_key: personKey,
    name: personKey.replace(/-/g, " "),
    club: "IFK Mora OK",
    class_name: "H21",
    place: 1,
    time: "35:00",
    status: "OK",
    parse_source: "test",
    parse_confidence: "high",
  };
}

beforeAll(() => {
  process.env.DATA_SOURCE = "db";
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = pgliteDir;
  fs.mkdirSync(path.join(dataDir, "content"), { recursive: true });
  // Point content writes at temp data dir by overriding cwd expectation:
  // getRepoDataDir uses process.cwd()/../data — so we run with cwd = tempRoot/web
});

afterAll(async () => {
  await resetDbForTests();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("db schema and CRUD", () => {
  it("applies schema and stores events/results/documents", async () => {
    await resetDbForTests();
    const db = await getDb();
    await applySchema(db);

    await upsertEvent(db, sampleEvent(1));
    await upsertEvent(db, sampleEvent(2, { name: "Andra", date: "2024-06-01" }));
    expect(await getNextEventId(db)).toBe(3);
    expect(await countEvents(db)).toBe(2);

    const results = [sampleResult(1, "anna-andersson"), sampleResult(1, "bosse-berg")];
    await replaceAllResults(db, results);
    expect(await countResults(db)).toBe(2);

    await setDocument(db, "people-index", [{ person_key: "anna-andersson", display_name: "Anna" }]);
    const people = await getDocument(db, "people-index", []);
    expect(people).toHaveLength(1);

    const updated = await updateEventType(db, 1, "Tränings ol");
    expect(updated.type).toBe("Tränings ol");

    await replaceResultsForEvent(db, 1, [sampleResult(1, "anna-andersson")]);
    expect(await countResults(db)).toBe(1);

    const events = await listEvents(db);
    expect(events[0].id).toBe(2); // newest date first
    expect((await listResults(db))[0].person_key).toBe("anna-andersson");
  });

  it("loads a snapshot for the app cache", async () => {
    await resetDbForTests();
    const db = await getDb();
    await applySchema(db);
    await db.exec("DELETE FROM results; DELETE FROM events; DELETE FROM app_documents;");
    await upsertEvent(db, sampleEvent(10, { name: "Snapshot" }));
    await replaceAllResults(db, [sampleResult(10, "calle-carlsson")]);
    await setDocument(db, "people-index", []);
    await setDocument(db, "person-aliases", []);
    await setDocument(db, "type-aliases", []);
    await setDocument(db, "stats-exclusions", [458]);
    await setDocument(db, "mastarnas", { seasons: [], classes: [], disciplines: [] });

    invalidateDbSnapshot();
    const snapshot = await loadDbSnapshot(db);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0].name).toBe("Snapshot");
    expect(snapshot.statsExclusions).toEqual([458]);
  });
});

describe("local content store", () => {
  it("writes content next to repo data dir", async () => {
    // Use real repo data dir under a unique high id to avoid clobbering
    const eventId = 9_000_001;
    const buffer = Buffer.from("<ResultList/>", "utf-8");
    const stored = await storeContentFile({
      eventId,
      buffer,
      filename: "sample.xml",
    });
    expect(stored.storedName).toBe(`${eventId}.xml`);
    expect(stored.localFile).toBe(`content/${eventId}.xml`);
    expect(stored.contentUrl).toBeNull();

    const found = findLocalContentFile(eventId);
    expect(found?.ext).toBe(".xml");
    expect(fs.readFileSync(found!.path, "utf-8")).toContain("ResultList");

    fs.unlinkSync(found!.path);
  });
});
