import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  addMastarnasClass,
  addMastarnasDiscipline,
  createMastarnasSeason,
  saveMastarnasClassResults,
  upsertMastarnasEvent,
} from "@/lib/mastarnas-data";
import { getMastarnasSeason } from "@/lib/mastarnas";
import type { MastarnasResultInput } from "@/lib/mastarnas-types";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const eventId = url.searchParams.get("event_id") ?? "";
  const classId = url.searchParams.get("class_id") ?? "";
  const season = getMastarnasSeason(year);
  const event = season?.events.find((item) => item.id === eventId);
  const results = (event?.results ?? []).filter((result) => result.class_id === classId);
  return NextResponse.json({ results });
}

type Body = {
  action?: string;
  year?: number;
  name?: string;
  is_youth?: boolean;
  is_medel?: boolean;
  discipline_id?: string;
  event_id?: string;
  class_id?: string;
  date?: string;
  results?: MastarnasResultInput[];
};

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
      const deploy = await addMastarnasClass(String(body.name ?? ""), Boolean(body.is_youth));
      return NextResponse.json({ ok: true, deploy });
    }
    if (action === "addDiscipline") {
      const deploy = await addMastarnasDiscipline(String(body.name ?? ""), Boolean(body.is_medel));
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

    return NextResponse.json({ error: "Okänd åtgärd." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte spara.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
