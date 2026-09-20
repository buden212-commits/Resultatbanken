import type { Event, ResultRow } from "../types";
import type { DbClient } from "./client";

type EventRow = {
  id: number;
  name: string;
  type: string;
  date: string;
  organizer: string;
  location: string;
  free_text: string;
  result_file: string;
  file_size: number | null;
  file_type: string;
  source_url: string;
  local_file: string | null;
  content_url: string | null;
  downloaded_at: string | null;
};

type ResultDbRow = {
  event_id: number;
  person_key: string;
  name: string;
  club: string | null;
  class_name: string | null;
  place: number | null;
  time: string | null;
  status: string | null;
  parse_source: string;
  parse_confidence: string;
};

function mapEvent(row: EventRow): Event {
  return {
    id: Number(row.id),
    name: row.name,
    type: row.type,
    date: row.date,
    organizer: row.organizer,
    location: row.location,
    free_text: row.free_text,
    result_file: row.result_file,
    file_size: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
    file_type: row.file_type,
    source_url: row.source_url,
    local_file: row.local_file,
    downloaded_at: row.downloaded_at,
  };
}

function mapResult(row: ResultDbRow): ResultRow {
  return {
    event_id: Number(row.event_id),
    person_key: row.person_key,
    name: row.name,
    club: row.club,
    class_name: row.class_name,
    place: row.place === null || row.place === undefined ? null : Number(row.place),
    time: row.time,
    status: row.status,
    parse_source: row.parse_source,
    parse_confidence: row.parse_confidence,
  };
}

export async function listEvents(db: DbClient): Promise<Event[]> {
  const rows = await db.query<EventRow>(
    `SELECT id, name, type, date, organizer, location, free_text, result_file,
            file_size, file_type, source_url, local_file, content_url, downloaded_at
     FROM events
     ORDER BY date DESC, id DESC`,
  );
  return rows.map(mapEvent);
}

export async function getEventById(db: DbClient, id: number): Promise<Event | undefined> {
  const rows = await db.query<EventRow>(
    `SELECT id, name, type, date, organizer, location, free_text, result_file,
            file_size, file_type, source_url, local_file, content_url, downloaded_at
     FROM events WHERE id = ?`,
    [id],
  );
  return rows[0] ? mapEvent(rows[0]) : undefined;
}

export async function getEventContentUrl(db: DbClient, id: number): Promise<string | null> {
  const rows = await db.query<{ content_url: string | null }>(
    "SELECT content_url FROM events WHERE id = ?",
    [id],
  );
  return rows[0]?.content_url ?? null;
}

export async function getNextEventId(db: DbClient): Promise<number> {
  const rows = await db.query<{ max_id: number | null }>("SELECT MAX(id) AS max_id FROM events");
  return Number(rows[0]?.max_id ?? 0) + 1;
}

export async function upsertEvent(
  db: DbClient,
  event: Event,
  contentUrl: string | null = null,
): Promise<void> {
  await db.query(
    `INSERT INTO events (
       id, name, type, date, organizer, location, free_text, result_file,
       file_size, file_type, source_url, local_file, content_url, downloaded_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       date = EXCLUDED.date,
       organizer = EXCLUDED.organizer,
       location = EXCLUDED.location,
       free_text = EXCLUDED.free_text,
       result_file = EXCLUDED.result_file,
       file_size = EXCLUDED.file_size,
       file_type = EXCLUDED.file_type,
       source_url = EXCLUDED.source_url,
       local_file = EXCLUDED.local_file,
       content_url = COALESCE(EXCLUDED.content_url, events.content_url),
       downloaded_at = EXCLUDED.downloaded_at`,
    [
      event.id,
      event.name ?? "",
      event.type ?? "",
      event.date ?? "",
      event.organizer ?? "",
      event.location ?? "",
      event.free_text ?? "",
      event.result_file ?? "",
      event.file_size ?? null,
      event.file_type ?? "",
      event.source_url ?? "",
      event.local_file ?? null,
      contentUrl ?? null,
      event.downloaded_at ?? null,
    ],
  );
}


export async function updateEventType(db: DbClient, eventId: number, type: string): Promise<Event> {
  const rows = await db.query<EventRow>(
    `UPDATE events SET type = ?
     WHERE id = ?
     RETURNING id, name, type, date, organizer, location, free_text, result_file,
               file_size, file_type, source_url, local_file, content_url, downloaded_at`,
    [type, eventId],
  );
  if (!rows[0]) {
    throw new Error("Eventet finns inte.");
  }
  return mapEvent(rows[0]);
}

export async function listResults(db: DbClient): Promise<ResultRow[]> {
  const rows = await db.query<ResultDbRow>(
    `SELECT event_id, person_key, name, club, class_name, place, time, status,
            parse_source, parse_confidence
     FROM results
     ORDER BY event_id, id`,
  );
  return rows.map(mapResult);
}

export async function listResultsForEvent(db: DbClient, eventId: number): Promise<ResultRow[]> {
  const rows = await db.query<ResultDbRow>(
    `SELECT event_id, person_key, name, club, class_name, place, time, status,
            parse_source, parse_confidence
     FROM results
     WHERE event_id = ?
     ORDER BY id`,
    [eventId],
  );
  return rows.map(mapResult);
}

export async function replaceResultsForEvent(
  db: DbClient,
  eventId: number,
  rows: ResultRow[],
): Promise<void> {
  await db.query("DELETE FROM results WHERE event_id = ?", [eventId]);
  for (const row of rows) {
    await db.query(
      `INSERT INTO results (
         event_id, person_key, name, club, class_name, place, time, status,
         parse_source, parse_confidence
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        row.person_key ?? "",
        row.name ?? "",
        row.club ?? null,
        row.class_name ?? null,
        row.place ?? null,
        row.time ?? null,
        row.status ?? null,
        row.parse_source ?? "",
        row.parse_confidence ?? "",
      ],
    );
  }
}

export async function replaceAllResults(db: DbClient, rows: ResultRow[]): Promise<void> {
  await db.exec("DELETE FROM results");
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    for (const row of batch) {
      placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      values.push(
        row.event_id,
        row.person_key ?? "",
        row.name ?? "",
        row.club ?? null,
        row.class_name ?? null,
        row.place ?? null,
        row.time ?? null,
        row.status ?? null,
        row.parse_source ?? "",
        row.parse_confidence ?? "",
      );
    }
    await db.query(
      `INSERT INTO results (
         event_id, person_key, name, club, class_name, place, time, status,
         parse_source, parse_confidence
       ) VALUES ${placeholders.join(", ")}`,
      values,
    );
  }
}

export async function countEvents(db: DbClient): Promise<number> {
  const rows = await db.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM events");
  return Number(rows[0]?.count ?? 0);
}

export async function countResults(db: DbClient): Promise<number> {
  const rows = await db.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM results");
  return Number(rows[0]?.count ?? 0);
}
