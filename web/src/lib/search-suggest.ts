import { formatDate, getEvents, searchPeople } from "@/lib/data";
import { searchEvents } from "@/lib/event-search";

export type PersonSuggestion = {
  person_key: string;
  display_name: string;
  result_count: number;
};

export type EventSuggestion = {
  id: number;
  name: string;
  subtitle: string;
};

export function getSearchSuggestions(query: string) {
  const trimmed = query.trim();
  const people = searchPeople(trimmed).map((person) => ({
    person_key: person.person_key,
    display_name: person.display_name,
    result_count: person.result_count,
  }));
  const events = searchEvents(getEvents(), trimmed).map((event) => ({
    id: event.id,
    name: event.name || event.type || `Resultat ${event.id}`,
    subtitle: [formatDate(event.date), event.location].filter(Boolean).join(" · "),
  }));

  return {
    people: people.slice(0, 5),
    events: events.slice(0, 5),
    results: people.slice(0, 8),
  };
}
