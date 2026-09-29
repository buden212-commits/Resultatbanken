/**
 * Event-centric year import of IFK Mora club results for Eventor leaderboards.
 */

import { eventorGet, fetchOrganisationId, isEventorConfigured } from "./eventor";
import {
  parseOrganisationResultsXml,
  type EventorClubResultRow,
} from "./eventor-person";
import { buildEventorLeaderboardSnapshot } from "./eventor-leaderboard-stats";
import type { EventorLeaderboardSnapshot } from "./eventor-leaderboard-types";

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

function collectEventIdsFromEntries(xml: string): string[] {
  const ids: string[] = [];
  for (const block of splitTopLevel(xml, "Entry")) {
    const eventId =
      block.match(/<Event>[\s\S]*?<EventId>(\d+)<\/EventId>/i)?.[1] ||
      firstLeaf(block, "EventId");
    if (eventId) ids.push(eventId);
  }
  return ids;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export type EventorLeaderboardImportResult = {
  snapshot: EventorLeaderboardSnapshot;
  message: string;
};

export async function importEventorLeaderboards(
  year: number,
): Promise<EventorLeaderboardImportResult> {
  if (!isEventorConfigured()) {
    throw new Error("Eventor är inte konfigurerat. Sätt EVENTOR_API_KEY.");
  }
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new Error("Ogiltigt år.");
  }

  const organisationId = await fetchOrganisationId();
  const eventIds = new Set<string>();

  for (const range of monthRanges(year)) {
    const xml = await eventorGet("entries", {
      organisationIds: organisationId,
      fromEventDate: `${range.from} 00:00:00`,
      toEventDate: `${range.to} 23:59:59`,
      includeEventElement: "true",
    });
    for (const id of collectEventIdsFromEntries(xml)) {
      eventIds.add(id);
    }
  }

  const eventList = [...eventIds];
  const allRows: EventorClubResultRow[] = [];

  await mapPool(eventList, 4, async (eventId) => {
    try {
      const resultsXml = await eventorGet("results/organisation", {
        organisationIds: organisationId,
        eventId,
      });
      allRows.push(...parseOrganisationResultsXml(resultsXml));
    } catch {
      // No results published yet — skip
    }
  });

  // Keep only rows that belong to the requested year (entries can spill nearby)
  const yearPrefix = String(year);
  const rows = allRows.filter((row) => row.date.startsWith(yearPrefix));

  const snapshot = buildEventorLeaderboardSnapshot(year, rows, {
    eventsScanned: eventList.length,
  });

  return {
    snapshot,
    message: `Topplistor ${year}: ${snapshot.personCount} löpare, ${snapshot.resultCount} resultat från ${eventList.length} tävlingar.`,
  };
}
