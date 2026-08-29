import type { Event, Person, ResultRow } from "./types";

type PersonAccumulator = {
  display_name: string;
  result_count: number;
  first_date: string | null;
  last_date: string | null;
  event_ids: Set<number>;
  results: Person["results"];
  seen_results: Set<string>;
};

function dedupeKey(row: ResultRow): string {
  return JSON.stringify([
    row.event_id,
    row.class_name ?? null,
    row.place ?? null,
    row.time ?? null,
    row.status ?? null,
  ]);
}

export function rebuildPeopleIndexFromResults(results: ResultRow[], events: Event[]): Person[] {
  const manifest = new Map(events.map((event) => [event.id, event]));
  const grouped = new Map<string, PersonAccumulator>();

  for (const row of results) {
    const key = row.person_key;
    let person = grouped.get(key);

    if (!person) {
      person = {
        display_name: row.name,
        result_count: 0,
        first_date: null,
        last_date: null,
        event_ids: new Set<number>(),
        results: [],
        seen_results: new Set<string>(),
      };
      grouped.set(key, person);
    }

    const rowKey = dedupeKey(row);
    if (person.seen_results.has(rowKey)) {
      continue;
    }
    person.seen_results.add(rowKey);

    person.result_count += 1;
    person.event_ids.add(row.event_id);

    const event = manifest.get(row.event_id);
    const date = event?.date ?? null;

    if (date) {
      if (person.first_date === null || date < person.first_date) {
        person.first_date = date;
      }
      if (person.last_date === null || date > person.last_date) {
        person.last_date = date;
      }
    }

    person.results.push({
      event_id: row.event_id,
      event_name: event?.name ?? "",
      date,
      location: event?.location ?? "",
      type: event?.type ?? "",
      class_name: row.class_name,
      place: row.place,
      time: row.time,
      status: row.status,
    });
  }

  const people: Person[] = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([personKey, person]) => ({
      person_key: personKey,
      display_name: person.display_name,
      result_count: person.result_count,
      first_date: person.first_date,
      last_date: person.last_date,
      event_ids: [...person.event_ids].sort((a, b) => a - b),
      results: [...person.results].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    }));

  people.sort((a, b) => a.display_name.localeCompare(b.display_name, "sv"));

  return people;
}
