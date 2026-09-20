/**
 * Import IFK Mora DNS/DNF starts + entry fees for a calendar year from Eventor.
 * Relays (TeamMemberResult) are excluded. Multi-day events are one row per person/event.
 */

import { eventorGet, fetchOrganisationId, isEventorConfigured } from "./eventor";
import { listClubPersons } from "./eventor-person";
import type { DnsFeeRow, DnsFeeStatus, DnsFeeTrackerData } from "./dns-fee-types";

function firstLeaf(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "i");
  return xml.match(re)?.[1]?.trim() ?? "";
}

function splitTopLevel(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(re) ?? [];
}

function monthRanges(year: number): { from: string; to: string }[] {
  const ranges: { from: string; to: string }[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    ranges.push({ from, to });
  }
  return ranges;
}

function isPlaceholderEventName(name: string, eventId: string): boolean {
  return !name || name === `Eventor ${eventId}` || /^Eventor\s+\d+$/i.test(name);
}

type EventMeta = {
  eventId: string;
  eventName: string;
  date: string;
};

function parseEventMetaFromXml(xml: string, eventId: string): EventMeta {
  const eventBlock = xml.match(/<Event\b[\s\S]*?<\/Event>/i)?.[0] ?? xml;
  const name = firstLeaf(eventBlock, "Name");
  const date =
    eventBlock.match(/<StartDate>[\s\S]*?<Date>([^<]+)<\/Date>/i)?.[1]?.trim().slice(0, 10) ||
    firstLeaf(eventBlock, "Date").slice(0, 10);
  return {
    eventId,
    eventName: name || `Eventor ${eventId}`,
    date: date || "",
  };
}

function mergeEventMeta(current: EventMeta | undefined, next: EventMeta): EventMeta {
  if (!current) return next;
  const preferNextName =
    isPlaceholderEventName(current.eventName, current.eventId) &&
    !isPlaceholderEventName(next.eventName, next.eventId);
  const preferNextDate = !current.date && Boolean(next.date);
  return {
    eventId: current.eventId,
    eventName: preferNextName ? next.eventName : current.eventName,
    date: preferNextDate ? next.date : current.date || next.date,
  };
}

type ParsedEntry = {
  entryId: string;
  personId: string;
  personName: string;
  eventId: string;
  eventName: string;
  date: string;
  eventClassId: string;
  feeIds: string[];
};

function parseEntriesXml(xml: string): ParsedEntry[] {
  const rows: ParsedEntry[] = [];
  for (const block of splitTopLevel(xml, "Entry")) {
    const personId = firstLeaf(block, "PersonId");
    const family = firstLeaf(block, "Family");
    const given = firstLeaf(block, "Given");
    const eventId =
      block.match(/<Event>[\s\S]*?<EventId>(\d+)<\/EventId>/i)?.[1] ||
      firstLeaf(block, "EventId");
    if (!personId || !eventId) continue;

    const nestedEvent = block.match(/<Event\b[\s\S]*?<\/Event>/i)?.[0];
    const meta = nestedEvent
      ? parseEventMetaFromXml(nestedEvent, eventId)
      : { eventId, eventName: `Eventor ${eventId}`, date: "" };

    const feeIds = [...block.matchAll(/<EntryEntryFee\b[\s\S]*?<EntryFeeId>(\d+)<\/EntryFeeId>/gi)].map(
      (m) => m[1],
    );

    rows.push({
      entryId: firstLeaf(block, "EntryId") || "",
      personId,
      personName: [given, family].filter(Boolean).join(" ") || `Person ${personId}`,
      eventId,
      eventName: meta.eventName,
      date: meta.date,
      eventClassId: firstLeaf(block, "EventClassId"),
      feeIds,
    });
  }
  return rows;
}

function parseFeeAmounts(xml: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const block of splitTopLevel(xml, "EntryFee")) {
    const id = firstLeaf(block, "EntryFeeId");
    const amountRaw = firstLeaf(block, "Amount");
    const amount = Number(amountRaw.replace(",", "."));
    if (id && Number.isFinite(amount)) {
      map.set(id, amount);
    }
  }
  return map;
}

type ResultHit = {
  personId: string;
  personName: string;
  className: string;
  status: DnsFeeStatus;
};

function mapCompetitorStatus(raw: string): DnsFeeStatus | null {
  if (raw === "DidNotStart") return "dns";
  if (raw === "DidNotFinish") return "dnf";
  return null;
}

/** Individual DNS/DNF only — relay TeamMemberResult is ignored. */
function parseChargeableFromResults(xml: string): ResultHit[] {
  const hits: ResultHit[] = [];

  for (const classResult of splitTopLevel(xml, "ClassResult")) {
    const className =
      firstLeaf(classResult, "ClassShortName") || firstLeaf(classResult, "Name") || "–";

    for (const personResult of splitTopLevel(classResult, "PersonResult")) {
      const statusMatch = personResult.match(/CompetitorStatus[^>]*value="([^"]+)"/i);
      const mapped = mapCompetitorStatus(statusMatch?.[1] ?? "");
      if (!mapped) continue;
      const personId = firstLeaf(personResult, "PersonId");
      if (!personId) continue;
      const family = firstLeaf(personResult, "Family");
      const given = firstLeaf(personResult, "Given");
      hits.push({
        personId,
        personName: [given, family].filter(Boolean).join(" ") || `Person ${personId}`,
        className,
        status: mapped,
      });
    }
  }

  return hits;
}

/** One chargeable row per person+event (multi-day races collapse). DNF wins over DNS. */
function collapseHits(hits: ResultHit[]): ResultHit[] {
  const byKey = new Map<string, ResultHit>();
  for (const hit of hits) {
    const key = `${hit.personId}::${hit.className}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, hit);
      continue;
    }
    if (existing.status === "dns" && hit.status === "dnf") {
      byKey.set(key, hit);
    }
  }
  return [...byKey.values()];
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchEventMeta(eventId: string): Promise<EventMeta> {
  const xml = await eventorGet(`event/${eventId}`);
  return parseEventMetaFromXml(xml, eventId);
}

export type DnsFeeImportResult = {
  data: DnsFeeTrackerData;
  eventsScanned: number;
  dnsRows: number;
  message: string;
};

export async function importDnsFeesFromEventor(
  existing: DnsFeeTrackerData,
  year = 2026,
): Promise<DnsFeeImportResult> {
  if (!isEventorConfigured()) {
    throw new Error("Eventor är inte konfigurerat. Sätt EVENTOR_API_KEY.");
  }

  const organisationId = await fetchOrganisationId();
  const clubMembers = await listClubPersons();
  const allEntries: ParsedEntry[] = [];

  for (const range of monthRanges(year)) {
    const xml = await eventorGet("entries", {
      organisationIds: organisationId,
      fromEventDate: `${range.from} 00:00:00`,
      toEventDate: `${range.to} 23:59:59`,
      includePersonElement: "true",
      includeEventElement: "true",
    });
    allEntries.push(...parseEntriesXml(xml));
  }

  const events = new Map<string, EventMeta>();
  for (const entry of allEntries) {
    events.set(
      entry.eventId,
      mergeEventMeta(events.get(entry.eventId), {
        eventId: entry.eventId,
        eventName: entry.eventName,
        date: entry.date,
      }),
    );
  }

  const eventList = [...events.values()];
  const rowMap = new Map<string, DnsFeeRow>();

  await mapPool(eventList, 4, async (eventSeed) => {
    let resultsXml = "";
    try {
      resultsXml = await eventorGet("results/organisation", {
        organisationIds: organisationId,
        eventId: eventSeed.eventId,
      });
    } catch {
      return;
    }

    let event = mergeEventMeta(eventSeed, parseEventMetaFromXml(resultsXml, eventSeed.eventId));
    if (isPlaceholderEventName(event.eventName, event.eventId) || !event.date) {
      try {
        event = mergeEventMeta(event, await fetchEventMeta(event.eventId));
      } catch {
        // keep whatever we have
      }
    }
    events.set(event.eventId, event);

    const dnsHits = collapseHits(parseChargeableFromResults(resultsXml));
    if (dnsHits.length === 0) return;

    let feeMap = new Map<string, number>();
    let feeEntries: ParsedEntry[] = [];
    try {
      const [feesXml, entriesXml] = await Promise.all([
        eventorGet(`entryfees/events/${event.eventId}`),
        eventorGet("entries", {
          organisationIds: organisationId,
          eventIds: event.eventId,
          includeEntryFees: "true",
          includePersonElement: "true",
          includeEventElement: "true",
        }),
      ]);
      feeMap = parseFeeAmounts(feesXml);
      feeEntries = parseEntriesXml(entriesXml);
    } catch {
      // keep fee null if fee endpoints fail
    }

    const feeEntryByPerson = new Map<string, ParsedEntry>();
    for (const entry of feeEntries) {
      feeEntryByPerson.set(entry.personId, entry);
      events.set(
        entry.eventId,
        mergeEventMeta(events.get(entry.eventId), {
          eventId: entry.eventId,
          eventName: entry.eventName,
          date: entry.date,
        }),
      );
    }
    for (const entry of allEntries) {
      if (entry.eventId === event.eventId && !feeEntryByPerson.has(entry.personId)) {
        feeEntryByPerson.set(entry.personId, entry);
      }
    }

    const resolved = events.get(event.eventId) ?? event;

    for (const hit of dnsHits) {
      const entry = feeEntryByPerson.get(hit.personId);
      let feeSek: number | null = null;
      if (entry && entry.feeIds.length > 0) {
        let sum = 0;
        let found = false;
        for (const feeId of entry.feeIds) {
          const amount = feeMap.get(feeId);
          if (amount !== undefined) {
            sum += amount;
            found = true;
          }
        }
        feeSek = found ? sum : null;
      }

      const row: DnsFeeRow = {
        personId: hit.personId,
        personName: hit.personName || entry?.personName || `Person ${hit.personId}`,
        eventId: resolved.eventId,
        eventName: resolved.eventName,
        date: resolved.date,
        className: hit.className,
        status: hit.status,
        feeSek,
        entryId: entry?.entryId || null,
      };

      // One row per person+event (avoid multi-day fee multiplication).
      const key = `${row.personId}::${row.eventId}`;
      const existingRow = rowMap.get(key);
      if (!existingRow) {
        rowMap.set(key, row);
        continue;
      }
      if (existingRow.status === "dns" && row.status === "dnf") {
        rowMap.set(key, { ...row, feeSek: existingRow.feeSek ?? row.feeSek });
      }
    }
  });

  const rows = [...rowMap.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const nameCmp = a.personName.localeCompare(b.personName, "sv");
    if (nameCmp !== 0) return nameCmp;
    return a.eventName.localeCompare(b.eventName, "sv");
  });

  const data: DnsFeeTrackerData = {
    year,
    importedAt: new Date().toISOString(),
    rows,
    members: clubMembers.map((person) => ({
      personId: person.personId,
      personName: person.displayName,
    })),
    exemptEventIds: [...new Set(existing.exemptEventIds.map(String))],
  };

  return {
    data,
    eventsScanned: eventList.length,
    dnsRows: rows.length,
    message: `Importerade ${rows.length} DNS/DNF-starter och ${clubMembers.length} medlemmar från ${eventList.length} tävlingar (${year}).`,
  };
}
