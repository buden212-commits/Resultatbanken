export type DnsFeeStatus = "dns" | "dnf";

export type DnsFeeRow = {
  personId: string;
  personName: string;
  eventId: string;
  eventName: string;
  date: string;
  className: string;
  /** dns = DidNotStart, dnf = DidNotFinish */
  status: DnsFeeStatus;
  /** Full entry fee in SEK from Eventor (raw). */
  feeSek: number | null;
  entryId: string | null;
};

export type DnsFeeEventRef = {
  eventId: string;
  eventName: string;
  date: string;
};

export type DnsFeeMember = {
  personId: string;
  personName: string;
};

export type DnsFeeTrackerData = {
  year: number;
  importedAt: string | null;
  rows: DnsFeeRow[];
  /** All IFK Mora club members at last import (including those without DNS/DNF). */
  members: DnsFeeMember[];
  /** Eventor event IDs where fee should not be charged to the participant. */
  exemptEventIds: string[];
};

export type DnsFeePersonSummary = {
  personId: string;
  personName: string;
  /** DNS + DNF starts counted. */
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
    members: [],
    exemptEventIds: [],
  };
}

export function normalizeDnsFeeStatus(value: unknown): DnsFeeStatus {
  return value === "dnf" ? "dnf" : "dns";
}

export function isEventExempt(data: DnsFeeTrackerData, eventId: string): boolean {
  return data.exemptEventIds.includes(eventId);
}

/** Exempt events waive DNS fees; DNF is always payable. */
export function feeToPaySek(data: DnsFeeTrackerData, row: DnsFeeRow): number {
  const fee = row.feeSek ?? 0;
  if (normalizeDnsFeeStatus(row.status) === "dnf") {
    return fee;
  }
  if (isEventExempt(data, row.eventId)) {
    return 0;
  }
  return fee;
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

  for (const member of data.members ?? []) {
    byPerson.set(member.personId, {
      personId: member.personId,
      personName: member.personName,
      dnsCount: 0,
      feeSek: 0,
      feeToPaySek: 0,
      rows: [],
    });
  }

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
    if (!existing.personName && row.personName) {
      existing.personName = row.personName;
    }
    existing.dnsCount += 1;
    existing.feeSek += fee;
    existing.feeToPaySek += toPay;
    existing.rows.push(row);
  }

  return [...byPerson.values()].sort((a, b) => a.personName.localeCompare(b.personName, "sv"));
}
