import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

import {
  fetchMastarnasFromGitHub,
  isGitDeployConfigured,
  publishMastarnasToGitHub,
} from "./github-deploy";
import { emptyMastarnasData } from "./mastarnas-defaults";
import { readMastarnasData } from "./mastarnas";
import { toSlug } from "./slug";
import { resolvePersonKey } from "./person-aliases";
import type {
  MastarnasClass,
  MastarnasData,
  MastarnasDiscipline,
  MastarnasEvent,
  MastarnasResult,
  MastarnasResultInput,
  MastarnasStatus,
} from "./mastarnas-types";

const DATA_PATH = path.join(process.cwd(), "..", "data", "mastarnas.json");

export type MastarnasDeploy = { mode: "local" | "git"; ok: boolean; message: string };

function writeLocal(data: MastarnasData): void {
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

async function readForWrite(): Promise<MastarnasData> {
  if (isGitDeployConfigured()) {
    return fetchMastarnasFromGitHub();
  }
  return readMastarnasData();
}

async function persist(data: MastarnasData, message: string): Promise<MastarnasDeploy> {
  if (isGitDeployConfigured()) {
    const result = await publishMastarnasToGitHub(data, message);
    revalidatePath("/mastarnas");
    revalidatePath("/mastarnas/[year]", "page");
    return { mode: "git", ok: result.ok, message: result.message };
  }
  writeLocal(data);
  revalidatePath("/mastarnas");
  revalidatePath("/mastarnas/[year]", "page");
  return { mode: "local", ok: true, message: "Sparat." };
}

function uniqueId(prefix: string, existing: Set<string>): string {
  let id = `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  while (existing.has(id)) {
    id = `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return id;
}

export async function createMastarnasSeason(year: number): Promise<MastarnasDeploy> {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new Error("Ogiltigt år.");
  }
  const data = await readForWrite();
  if (data.seasons.some((season) => season.year === year)) {
    throw new Error(`År ${year} finns redan.`);
  }

  const events: MastarnasEvent[] = data.disciplines.map((discipline) => ({
    id: `${year}-${discipline.id}`,
    discipline_id: discipline.id,
    name: discipline.name,
    date: "",
    results: [],
  }));

  data.seasons.push({ year, events });
  data.seasons.sort((a, b) => b.year - a.year);
  return persist(data, `Skapa Mästarnas Mästare ${year}`);
}

export async function addMastarnasClass(name: string, isYouth: boolean): Promise<MastarnasDeploy> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Klassnamn krävs.");
  }
  const data = await readForWrite();
  const id = toSlug(trimmed) || uniqueId("klass", new Set(data.classes.map((item) => item.id)));
  if (data.classes.some((item) => item.id === id || item.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("Klassen finns redan.");
  }
  const klass: MastarnasClass = { id, name: trimmed, is_youth: isYouth };
  data.classes.push(klass);
  data.classes.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  return persist(data, `Ny MM-klass: ${trimmed}`);
}

export async function addMastarnasDiscipline(name: string, isMedel = false): Promise<MastarnasDeploy> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Grennamn krävs.");
  }
  const data = await readForWrite();
  const id = toSlug(trimmed) || uniqueId("gren", new Set(data.disciplines.map((item) => item.id)));
  if (data.disciplines.some((item) => item.id === id || item.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("Grenen finns redan.");
  }
  const sort_order = Math.max(0, ...data.disciplines.map((item) => item.sort_order)) + 1;
  const disciplines: MastarnasDiscipline[] = isMedel
    ? data.disciplines.map((item) => ({ ...item, is_medel: false }))
    : data.disciplines;
  disciplines.push({ id, name: trimmed, sort_order, is_medel: isMedel });
  data.disciplines = disciplines;
  return persist(data, `Ny MM-gren: ${trimmed}`);
}

export async function upsertMastarnasEvent(
  year: number,
  disciplineId: string,
  fields: { name?: string; date?: string },
): Promise<MastarnasDeploy> {
  const data = await readForWrite();
  const season = data.seasons.find((item) => item.year === year);
  if (!season) {
    throw new Error("Året finns inte.");
  }
  const discipline = data.disciplines.find((item) => item.id === disciplineId);
  if (!discipline) {
    throw new Error("Grenen finns inte.");
  }

  let event = season.events.find((item) => item.discipline_id === disciplineId);
  if (!event) {
    event = {
      id: `${year}-${disciplineId}`,
      discipline_id: disciplineId,
      name: fields.name?.trim() || discipline.name,
      date: fields.date?.trim() || "",
      results: [],
    };
    season.events.push(event);
  } else {
    if (fields.name !== undefined) {
      event.name = fields.name.trim() || discipline.name;
    }
    if (fields.date !== undefined) {
      event.date = fields.date.trim();
    }
  }
  return persist(data, `Uppdatera ${discipline.name} ${year}`);
}

function normalizeStatus(value: string): MastarnasStatus {
  if (value === "dnf" || value === "dns" || value === "ok") {
    return value;
  }
  throw new Error("Ogiltig status.");
}

export async function saveMastarnasClassResults(
  year: number,
  eventId: string,
  classId: string,
  rows: MastarnasResultInput[],
): Promise<MastarnasDeploy> {
  const data = await readForWrite();
  const season = data.seasons.find((item) => item.year === year);
  if (!season) {
    throw new Error("Året finns inte.");
  }
  const event = season.events.find((item) => item.id === eventId);
  if (!event) {
    throw new Error("Deltävlingen finns inte.");
  }
  if (!data.classes.some((item) => item.id === classId)) {
    throw new Error("Klassen finns inte.");
  }

  const seen = new Set<string>();
  const next: MastarnasResult[] = [];
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      throw new Error("Namn krävs på varje rad.");
    }
    const status = normalizeStatus(row.status);
    if (status === "ok" && (row.place === null || row.place < 1)) {
      throw new Error(`Placering krävs för ${name}.`);
    }
    const personKey = resolvePersonKey(row.person_key?.trim() || toSlug(name));
    if (!personKey) {
      throw new Error(`Kunde inte skapa nyckel för ${name}.`);
    }
    if (seen.has(personKey)) {
      throw new Error(`${name} är redan tillagd i klassen.`);
    }
    seen.add(personKey);
    next.push({
      id: crypto.randomUUID(),
      person_key: personKey,
      name,
      class_id: classId,
      place: status === "ok" ? row.place : row.place,
      status,
      points: null,
    });
  }

  event.results = [...event.results.filter((result) => result.class_id !== classId), ...next];
  return persist(data, `MM-resultat ${year} / ${classId}`);
}

export function getMastarnasDataOrEmpty(): MastarnasData {
  try {
    return readMastarnasData();
  } catch {
    return emptyMastarnasData();
  }
}
