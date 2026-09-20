export type DnsFeeRow = {
  personId: string;
  personName: string;
  eventId: string;
  eventName: string;
  date: string;
  className: string;
  /** Full entry fee in SEK from Eventor (raw). */
  feeSek: number | null;
  entryId: string | null;
};

export type DnsFeeEventRef = {
  eventId: string;
  eventName: string;
  date: string;
};

export type DnsFeeTrackerData = {
  year: number;
  importedAt: string | null;
  rows: DnsFeeRow[];
  /** Eventor event IDs where fee should not be charged to the participant. */
  exemptEventIds: string[];
};

export type DnsFeePersonSummary = {
  personId: string;
  personName: string;
  dnsCount: number;
  feeSek: number;
  feeToPaySek: number;
  rows: DnsFeeRow[];
};

export function emptyDnsFeeTracker(year = 2026): DnsFeeTrackerData {
  return {
    year,
    importedAt: null,
    rows: [],
    exemptEventIds: [],
  };
}

export function isEventExempt(data: DnsFeeTrackerData, eventId: string): boolean {
  return data.exemptEventIds.includes(eventId);
}

export function feeToPaySek(data: DnsFeeTrackerData, row: DnsFeeRow): number {
  if (isEventExempt(data, row.eventId)) return 0;
  return row.feeSek ?? 0;
}

export function listEventsFromRows(rows: DnsFeeRow[]): DnsFeeEventRef[] {
  const map = new Map<string, DnsFeeEventRef>();
  for (const row of rows) {
    if (!map.has(row.eventId)) {
      map.set(row.eventId, {
        eventId: row.eventId,
        eventName: row.eventName,
        date: row.date,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.date === b.date
      ? a.eventName.localeCompare(b.eventName, "sv")
      : a.date < b.date
        ? 1
        : -1,
  );
}

export function summarizeDnsFeesByPerson(data: DnsFeeTrackerData): DnsFeePersonSummary[] {
  const byPerson = new Map<string, DnsFeePersonSummary>();

  for (const row of data.rows) {
    const existing = byPerson.get(row.personId);
    const fee = row.feeSek ?? 0;
    const toPay = feeToPaySek(data, row);
    if (!existing) {
      byPerson.set(row.personId, {
        personId: row.personId,
        personName: row.personName,
        dnsCount: 1,
        feeSek: fee,
        feeToPaySek: toPay,
        rows: [row],
      });
      continue;
    }
    existing.dnsCount += 1;
    existing.feeSek += fee;
    existing.feeToPaySek += toPay;
    existing.rows.push(row);
  }

  return [...byPerson.values()].sort((a, b) => a.personName.localeCompare(b.personName, "sv"));
}
