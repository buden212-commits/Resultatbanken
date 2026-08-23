import fs from "fs";
import path from "path";

import type { Person, PersonResult } from "./types";
import {
  getKeysForGroup,
  resolveDisplayName,
  resolvePersonKey,
} from "./person-aliases";

const DATA_DIR = path.join(process.cwd(), "..", "data");

function getPeopleIndex(): Person[] {
  return JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "people-index.json"), "utf-8"),
  ) as Person[];
}

function mergePeople(people: Person[], canonicalKey: string, displayName: string): Person {
  const seenResults = new Set<string>();
  const results: PersonResult[] = [];
  const eventIds = new Set<number>();
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const person of people) {
    for (const result of person.results) {
      const dedupeKey = [
        result.event_id,
        result.class_name,
        result.place,
        result.time,
        result.status,
      ].join("|");
      if (seenResults.has(dedupeKey)) {
        continue;
      }
      seenResults.add(dedupeKey);
      results.push(result);
      eventIds.add(result.event_id);

      const date = result.date;
      if (date) {
        if (!firstDate || date < firstDate) {
          firstDate = date;
        }
        if (!lastDate || date > lastDate) {
          lastDate = date;
        }
      }
    }
  }

  results.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    person_key: canonicalKey,
    display_name: displayName,
    result_count: results.length,
    first_date: firstDate,
    last_date: lastDate,
    event_ids: [...eventIds].sort((a, b) => a - b),
    results,
  };
}

export function getMergedPerson(key: string): Person | undefined {
  const canonicalKey = resolvePersonKey(key);
  const keys = getKeysForGroup(canonicalKey);
  const people = keys
    .map((personKey) => getPeopleIndex().find((person) => person.person_key === personKey))
    .filter((person): person is Person => !!person);

  if (people.length === 0) {
    return undefined;
  }

  const displayName = resolveDisplayName(
    canonicalKey,
    people.find((person) => person.person_key === canonicalKey)?.display_name ?? people[0].display_name,
  );

  return mergePeople(people, canonicalKey, displayName);
}

export function searchMergedPeople(query: string): Person[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const matches = getPeopleIndex().filter((person) => {
    const resolvedName = resolveDisplayName(person.person_key, person.display_name);
    return (
      person.display_name.toLowerCase().includes(normalized) ||
      resolvedName.toLowerCase().includes(normalized)
    );
  });

  const byCanonical = new Map<string, Person>();
  for (const person of matches) {
    const merged = getMergedPerson(person.person_key);
    if (!merged) {
      continue;
    }
    byCanonical.set(merged.person_key, merged);
  }

  return [...byCanonical.values()]
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "sv"))
    .slice(0, 50);
}
