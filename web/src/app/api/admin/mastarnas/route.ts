import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getEvent, getEvents, getResolvedResultsForEvent } from "@/lib/data";
import {
  addMastarnasClass,
  addMastarnasDiscipline,
  createMastarnasSeason,
  importArchiveToMastarnas,
  saveMastarnasClassResults,
  upsertMastarnasEvent,
} from "@/lib/mastarnas-data";
import { readMastarnasData } from "@/lib/mastarnas";
import {
  buildImportPreview,
  searchArchiveEvents,
  suggestDisciplineId,
  summarizeSourceClasses,
} from "@/lib/mastarnas-import";
import type { MastarnasResultInput } from "@/lib/mastarnas-types";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const url = new URL(request.url);
  if (url.searchParams.has("search")) {
    const events = searchArchiveEvents(getEvents(), url.searchParams.get("search") ?? "");
    return NextResponse.json({ events });
  }

  const previewEventId = Number(url.searchParams.get("preview_event"));
  if (previewEventId) {
    const event = getEvent(previewEventId);
    if (!event) {
      return NextResponse.json({ error: "Resultat hittades inte." }, { status: 404 });
    }
    const data = readMastarnasData();
    const rows = getResolvedResultsForEvent(previewEventId);
    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        type: event.type,
        date: event.date,
        location: event.location,
      },
      suggested_year: Number(event.date.slice(0, 4)) || null,
      suggested_discipline_id: suggestDisciplineId(event, data.disciplines),
      source_classes: summarizeSourceClasses(rows, data.classes, data.class_import_map ?? {}),
      result_count: rows.length,
    });
  }

  return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
}

type Body = {
  action?: string;
  year?: number;
  name?: string;
  is_youth?: boolean;
  is_medel?: boolean;
  discipline_id?: string;
  event_id?: string;
  archive_event_id?: number;
  class_id?: string;
  date?: string;
  mapping?: Record<string, string>;
  results?: MastarnasResultInput[];
};

function previewFromArchive(archiveEventId: number, mapping: Record<string, string>) {
  const event = getEvent(archiveEventId);
  if (!event) {
    throw new Error("Resultat hittades inte.");
  }
  const data = readMastarnasData();
  const preview = buildImportPreview(getResolvedResultsForEvent(archiveEventId), mapping, data.classes);
  return { event, preview };
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Body;
    const action = body.action;

    if (action === "createSeason") {
      const deploy = await createMastarnasSeason(Number(body.year));
      return NextResponse.json({ ok: true, deploy });
    }
    if (action === "addClass") {
      const { deploy, klass } = await addMastarnasClass(String(body.name ?? ""), Boolean(body.is_youth));
      return NextResponse.json({ ok: true, deploy, klass });
    }
    if (action === "addDiscipline") {
      const deploy = await addMastarnasDiscipline(
        String(body.name ?? ""),
        Boolean(body.is_medel),
        Number.isInteger(body.year) ? Number(body.year) : undefined,
      );
      return NextResponse.json({ ok: true, deploy });
    }
    if (action === "upsertEvent") {
      const deploy = await upsertMastarnasEvent(Number(body.year), String(body.discipline_id ?? ""), {
        name: body.name,
        date: body.date,
      });
      return NextResponse.json({ ok: true, deploy });
    }
    if (action === "saveResults") {
      const deploy = await saveMastarnasClassResults(
        Number(body.year),
        String(body.event_id ?? ""),
        String(body.class_id ?? ""),
        Array.isArray(body.results) ? body.results : [],
      );
      return NextResponse.json({ ok: true, deploy });
    }
    if (action === "previewImport") {
      const { preview } = previewFromArchive(Number(body.archive_event_id), body.mapping ?? {});
      return NextResponse.json({ ok: true, ...preview });
    }
    if (action === "importFromArchive") {
      const archiveEventId = Number(body.archive_event_id);
      const mapping = body.mapping ?? {};
      const { event, preview } = previewFromArchive(archiveEventId, mapping);
      if (preview.groups.length === 0) {
        throw new Error("Inga klasser att importera. Koppla minst en arkivklass till en MM-klass.");
      }
      const deploy = await importArchiveToMastarnas({
        year: Number(body.year),
        disciplineId: String(body.discipline_id ?? ""),
        eventDate: event.date,
        mapping,
        groups: preview.groups,
      });
      return NextResponse.json({ ok: true, deploy, imported: preview.groups.reduce((sum, group) => sum + group.rows.length, 0) });
    }

    return NextResponse.json({ error: "Okänd åtgärd." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
