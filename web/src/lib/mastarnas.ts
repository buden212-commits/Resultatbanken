import path from "path";

import { emptyMastarnasData } from "./mastarnas-defaults";
import { readCachedJsonIfExists } from "./json-cache";
import { resolveDisplayName, resolvePersonKey } from "./person-aliases";
import type { MastarnasData, MastarnasSeason } from "./mastarnas-types";
import type { Person } from "./types";

const DATA_PATH = path.join(process.cwd(), "..", "data", "mastarnas.json");

const globalForPeople = globalThis as typeof globalThis & {
  __rbMastarnasPeople?: WeakMap<MastarnasData, { person_key: string; display_name: string }[]>;
};

function peopleByData(): WeakMap<MastarnasData, { person_key: string; display_name: string }[]> {
  if (!globalForPeople.__rbMastarnasPeople) {
    globalForPeople.__rbMastarnasPeople = new WeakMap();
  }
  return globalForPeople.__rbMastarnasPeople;
}

export function readMastarnasData(): MastarnasData {
  return readCachedJsonIfExists(DATA_PATH, emptyMastarnasData());
}

export function getMastarnasSeasons(): MastarnasSeason[] {
  return [...readMastarnasData().seasons].sort((a, b) => b.year - a.year);
}

export function getMastarnasSeason(year: number): MastarnasSeason | undefined {
  return readMastarnasData().seasons.find((season) => season.year === year);
}

export function getLatestMastarnasYear(): number | null {
  return getMastarnasSeasons()[0]?.year ?? null;
}

export function getMastarnasPeople(): { person_key: string; display_name: string }[] {
  const data = readMastarnasData();
  const cached = peopleByData().get(data);
  if (cached) {
    return cached;
  }

  const people = new Map<string, string>();
  for (const season of data.seasons) {
    for (const event of season.events) {
      for (const result of event.results) {
        const key = resolvePersonKey(result.person_key);
        const name = resolveDisplayName(key, result.name);
        if (!people.has(key)) {
          people.set(key, name);
        }
      }
    }
  }
  const list = [...people.entries()].map(([person_key, display_name]) => ({ person_key, display_name }));
  peopleByData().set(data, list);
  return list;
}

export function getMastarnasOnlyPerson(key: string): Person | undefined {
  const canonical = resolvePersonKey(key);
  const match = getMastarnasPeople().find((person) => person.person_key === canonical);
  if (!match) {
    return undefined;
  }
  return {
    person_key: match.person_key,
    display_name: match.display_name,
    result_count: 0,
    first_date: null,
    last_date: null,
    event_ids: [],
    results: [],
  };
}

export function searchMastarnasPeople(query: string): Person[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  return getMastarnasPeople()
    .filter((person) => person.display_name.toLowerCase().includes(normalized))
    .slice(0, 50)
    .map((person) => ({
      person_key: person.person_key,
      display_name: person.display_name,
      result_count: 0,
      first_date: null,
      last_date: null,
      event_ids: [],
      results: [],
    }));
}
