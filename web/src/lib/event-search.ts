import type { Event } from "./types";

export function isKmEvent(event: Pick<Event, "name" | "type">): boolean {
  return /klubbmästerskap|\bkm\b/i.test(`${event.type} ${event.name}`);
}

export function eventSearchHaystack(event: Event): string {
  return [event.id, event.name, event.type, event.location, event.organizer, event.date, event.free_text]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesEventQuery(event: Event, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }
  const hay = eventSearchHaystack(event);
  return tokens.every((token) => hay.includes(token));
}

export function searchEvents(events: Event[], query: string): Event[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return events;
  }
  return events.filter((event) => matchesEventQuery(event, trimmed));
}
