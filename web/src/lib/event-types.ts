import { getEvents } from "./data";
import { typeKey } from "./slug";
import { resolveEventType } from "./type-aliases";

export type EventTypeOption = {
  type_key: string;
  display_type: string;
  event_count: number;
};

const EMPTY_TYPE_LABEL = "(tom typ)";

export function formatRawEventType(rawType: string): string {
  const trimmed = rawType.trim();
  return trimmed || EMPTY_TYPE_LABEL;
}

export function getEventTypesForAdmin(): EventTypeOption[] {
  const counts = new Map<string, number>();

  for (const event of getEvents()) {
    const label = formatRawEventType(event.type ?? "");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([display_type, event_count]) => ({
      type_key: typeKey(display_type === EMPTY_TYPE_LABEL ? "" : display_type),
      display_type,
      event_count,
    }))
    .sort((a, b) => a.display_type.localeCompare(b.display_type, "sv"));
}

/** Unique types for pickers — alias variants collapsed to one canonical label. */
export function getCanonicalEventTypesForPicker(): string[] {
  const types = new Set<string>();

  for (const event of getEvents()) {
    const raw = event.type?.trim();
    if (!raw) {
      continue;
    }
    types.add(resolveEventType(raw));
  }

  return [...types].sort((a, b) => a.localeCompare(b, "sv"));
}
