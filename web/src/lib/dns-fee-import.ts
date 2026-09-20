/**
 * Import IFK Mora DNS starts + entry fees for a calendar year from Eventor.
 */

import { eventorGet, fetchOrganisationId, isEventorConfigured } from "./eventor";
import type { DnsFeeRow, DnsFeeTrackerData } from "./dns-fee-types";

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

    const eventName =
      block.match(/<Event>[\s\S]*?<Name>([^<]+)<\/Name>/i)?.[1]?.trim() ||
      `Eventor ${eventId}`;
    const date =
      block.match(/<Event>[\s\S]*?<StartDate>[\s\S]*?<Date>([^<]+)<\/Date>/i)?.[1]?.trim().slice(0, 10) ||
      "";

    const feeIds = [...block.matchAll(/<EntryEntryFee\b[\s\S]*?<EntryFeeId>(\d+)<\/EntryFeeId>/gi)].map(
      (m) => m[1],
    );

    rows.push({
      entryId: firstLeaf(block, "EntryId") || "",
      personId,
      personName: [given, family].filter(Boolean).join(" ") || `Person ${personId}`,
      eventId,
      eventName,
      date,
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

type DnsHit = {
  personId: string;
  personName: string;
  className: string;
};

function parseDnsFromResults(xml: string): DnsHit[] {
  const hits: DnsHit[] = [];

  for (const classResult of splitTopLevel(xml, "ClassResult")) {
    const className =
      firstLeaf(classResult, "ClassShortName") || firstLeaf(classResult, "Name") || "–";

    for (const personResult of splitTopLevel(classResult, "PersonResult")) {
      const statusMatch = personResult.match(/CompetitorStatus[^>]*value="([^"]+)"/i);
      const status = statusMatch?.[1] ?? "";
      if (status !== "DidNotStart") continue;
      const personId = firstLeaf(personResult, "PersonId");
      if (!personId) continue;
      const family = firstLeaf(personResult, "Family");
      const given = firstLeaf(personResult, "Given");
      hits.push({
        personId,
        personName: [given, family].filter(Boolean).join(" ") || `Person ${personId}`,
        className,
      });
    }

    for (const teamMember of splitTopLevel(classResult, "TeamMemberResult")) {
      const statusMatch = teamMember.match(/CompetitorStatus[^>]*value="([^"]+)"/i);
      const status = statusMatch?.[1] ?? "";
      if (status !== "DidNotStart") continue;
      const personId = firstLeaf(teamMember, "PersonId");
      if (!personId) continue;
      const family = firstLeaf(teamMember, "Family");
      const given = firstLeaf(teamMember, "Given");
      hits.push({
        personId,
        personName: [given, family].filter(Boolean).join(" ") || `Person ${personId}`,
        className,
      });
    }
  }

  return hits;
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

  const events = new Map<string, { eventId: string; eventName: string; date: string }>();
  for (const entry of allEntries) {
    if (!events.has(entry.eventId)) {
      events.set(entry.eventId, {
        eventId: entry.eventId,
        eventName: entry.eventName,
        date: entry.date,
      });
    }
  }

  const eventList = [...events.values()];
  const rows: DnsFeeRow[] = [];

  await mapPool(eventList, 4, async (event) => {
    let resultsXml = "";
    try {
      resultsXml = await eventorGet("results/organisation", {
        organisationIds: organisationId,
        eventId: event.eventId,
      });
    } catch {
      return;
    }

    const dnsHits = parseDnsFromResults(resultsXml);
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
    }
    // fallback to month-scan entries without fee ids
    for (const entry of allEntries) {
      if (entry.eventId === event.eventId && !feeEntryByPerson.has(entry.personId)) {
        feeEntryByPerson.set(entry.personId, entry);
      }
    }

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

      rows.push({
        personId: hit.personId,
        personName: hit.personName || entry?.personName || `Person ${hit.personId}`,
        eventId: event.eventId,
        eventName: event.eventName || entry?.eventName || `Eventor ${event.eventId}`,
        date: event.date || entry?.date || "",
        className: hit.className,
        feeSek,
        entryId: entry?.entryId || null,
      });
    }
  });

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const nameCmp = a.personName.localeCompare(b.personName, "sv");
    if (nameCmp !== 0) return nameCmp;
    return a.eventName.localeCompare(b.eventName, "sv");
  });

  const data: DnsFeeTrackerData = {
    year,
    importedAt: new Date().toISOString(),
    rows,
    exemptEventIds: [...new Set(existing.exemptEventIds.map(String))],
  };

  return {
    data,
    eventsScanned: eventList.length,
    dnsRows: rows.length,
    message: `Importerade ${rows.length} DNS-starter från ${eventList.length} tävlingar (${year}).`,
  };
}
