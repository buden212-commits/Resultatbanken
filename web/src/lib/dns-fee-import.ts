/**
 * Import IFK Mora entry fees + DNS/DNF for a calendar year from Eventor.
 * Relays are excluded. Multi-day events collapse to one row per person/event.
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

function isRelayEventXml(xml: string): boolean {
  return /eventForm="[^"]*Relay/i.test(xml) || /<EventForm>\s*Relay/i.test(xml);
}

type EventMeta = {
  eventId: string;
  eventName: string;
  date: string;
  isRelay: boolean;
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
    isRelay: isRelayEventXml(eventBlock),
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
    isRelay: current.isRelay || next.isRelay,
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
  isRelay: boolean;
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
      : { eventId, eventName: `Eventor ${eventId}`, date: "", isRelay: false };

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
      isRelay: meta.isRelay,
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

function mapCompetitorStatus(raw: string): DnsFeeStatus {
  if (raw === "DidNotStart") return "dns";
  if (raw === "DidNotFinish") return "dnf";
  if (raw === "OK" || raw === "Finished" || raw === "Active") return "ok";
  return "ok";
}

const STATUS_RANK: Record<DnsFeeStatus, number> = {
  entered: 0,
  ok: 1,
  dns: 2,
  dnf: 3,
};

/** Individual results only — TeamMemberResult (relays) ignored. */
function parseIndividualResults(xml: string): ResultHit[] {
  const hits: ResultHit[] = [];

  for (const classResult of splitTopLevel(xml, "ClassResult")) {
    const className =
      firstLeaf(classResult, "ClassShortName") || firstLeaf(classResult, "Name") || "–";

    for (const personResult of splitTopLevel(classResult, "PersonResult")) {
      const statusMatch = personResult.match(/CompetitorStatus[^>]*value="([^"]+)"/i);
      const status = mapCompetitorStatus(statusMatch?.[1] ?? "OK");
      const personId = firstLeaf(personResult, "PersonId");
      if (!personId) continue;
      const family = firstLeaf(personResult, "Family");
      const given = firstLeaf(personResult, "Given");
      hits.push({
        personId,
        personName: [given, family].filter(Boolean).join(" ") || `Person ${personId}`,
        className,
        status,
      });
    }
  }

  return hits;
}

function collapseHitsByPerson(hits: ResultHit[]): Map<string, ResultHit> {
  const byPerson = new Map<string, ResultHit>();
  for (const hit of hits) {
    const existing = byPerson.get(hit.personId);
    if (!existing || STATUS_RANK[hit.status] > STATUS_RANK[existing.status]) {
      byPerson.set(hit.personId, hit);
    }
  }
  return byPerson;
}

function resolveFeeSek(entry: ParsedEntry | undefined, feeMap: Map<string, number>): number | null {
  if (!entry || entry.feeIds.length === 0) return null;
  let sum = 0;
  let found = false;
  for (const feeId of entry.feeIds) {
    const amount = feeMap.get(feeId);
    if (amount !== undefined) {
      sum += amount;
      found = true;
    }
  }
  return found ? sum : null;
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
        isRelay: entry.isRelay,
      }),
    );
  }

  const eventList = [...events.values()].filter((event) => !event.isRelay);
  const rowMap = new Map<string, DnsFeeRow>();

  await mapPool(eventList, 4, async (eventSeed) => {
    let resultsXml = "";
    let hasResults = false;
    try {
      resultsXml = await eventorGet("results/organisation", {
        organisationIds: organisationId,
        eventId: eventSeed.eventId,
      });
      hasResults = true;
    } catch {
      hasResults = false;
    }

    let event = eventSeed;
    if (hasResults) {
      event = mergeEventMeta(event, parseEventMetaFromXml(resultsXml, eventSeed.eventId));
    }
    if (isPlaceholderEventName(event.eventName, event.eventId) || !event.date) {
      try {
        event = mergeEventMeta(event, await fetchEventMeta(event.eventId));
      } catch {
        // keep whatever we have
      }
    }
    if (event.isRelay) {
      events.set(event.eventId, event);
      return;
    }
    events.set(event.eventId, event);

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
      feeEntries = parseEntriesXml(entriesXml).filter((entry) => !entry.isRelay);
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
          isRelay: entry.isRelay,
        }),
      );
    }
    for (const entry of allEntries) {
      if (entry.eventId === event.eventId && !entry.isRelay && !feeEntryByPerson.has(entry.personId)) {
        feeEntryByPerson.set(entry.personId, entry);
      }
    }

    if (feeEntryByPerson.size === 0) return;

    const resultByPerson = hasResults
      ? collapseHitsByPerson(parseIndividualResults(resultsXml))
      : new Map<string, ResultHit>();

    const resolved = events.get(event.eventId) ?? event;
    if (resolved.isRelay) return;

    for (const [personId, entry] of feeEntryByPerson) {
      const hit = resultByPerson.get(personId);
      const status: DnsFeeStatus = hit?.status ?? "entered";
      const feeSek = resolveFeeSek(entry, feeMap);

      const row: DnsFeeRow = {
        personId,
        personName: hit?.personName || entry.personName || `Person ${personId}`,
        eventId: resolved.eventId,
        eventName: resolved.eventName,
        date: resolved.date,
        className: hit?.className || "–",
        status,
        feeSek,
        entryId: entry.entryId || null,
      };

      const key = `${row.personId}::${row.eventId}`;
      const existingRow = rowMap.get(key);
      if (!existingRow) {
        rowMap.set(key, row);
        continue;
      }
      if (STATUS_RANK[row.status] > STATUS_RANK[existingRow.status]) {
        rowMap.set(key, { ...row, feeSek: existingRow.feeSek ?? row.feeSek });
      } else if (existingRow.feeSek === null && row.feeSek !== null) {
        rowMap.set(key, { ...existingRow, feeSek: row.feeSek });
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
      email: person.email,
    })),
    exemptEventIds: [...new Set(existing.exemptEventIds.map(String))],
  };

  const dnsRows = rows.filter((row) => row.status === "dns").length;

  return {
    data,
    eventsScanned: eventList.length,
    dnsRows,
    message: `Importerade ${rows.length} starter (${dnsRows} DNS) och ${clubMembers.length} medlemmar från ${eventList.length} tävlingar (${year}).`,
  };
}
