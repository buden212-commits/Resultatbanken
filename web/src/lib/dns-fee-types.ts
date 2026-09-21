export type DnsFeeStatus = "ok" | "dns" | "dnf" | "entered";

export type DnsFeeRow = {
  personId: string;
  personName: string;
  eventId: string;
  eventName: string;
  date: string;
  className: string;
  /** ok / dns / dnf from results, or entered if no result yet */
  status: DnsFeeStatus;
  /** Full entry fee in SEK from Eventor (raw). */
  feeSek: number | null;
  entryId: string | null;
  /**
   * Whether the event is in Sweden. Missing/undefined treated as Sweden
   * (legacy imports from Swedish Eventor).
   */
  inSweden?: boolean;
  /** Participant-submitted reason for DNS (Ej start). */
  dnsReason?: string | null;
  /** ISO timestamp when dnsReason was last saved. */
  dnsReasonAt?: string | null;
};

export type DnsFeeEventRef = {
  eventId: string;
  eventName: string;
  date: string;
};

export type DnsFeeMember = {
  personId: string;
  personName: string;
  email: string | null;
};

export type DnsFeeTrackerData = {
  year: number;
  importedAt: string | null;
  rows: DnsFeeRow[];
  /** All IFK Mora club members at last import (including those without starts). */
  members: DnsFeeMember[];
  /** Eventor event IDs where anmälningsavgift (OK/entered) should not burden the participant. DNS is always charged. */
  exemptEventIds: string[];
};

export type DnsFeePersonSummary = {
  personId: string;
  personName: string;
  email: string | null;
  /** Number of DNS starts. */
  dnsCount: number;
  /** Number of imported starts (all statuses). */
  startCount: number;
  /** Anmälningsavgift att betala (efter undantag för tävling / ungdom·junior). */
  entryFeeToPaySek: number;
  /** DNS-kostnad att betala (DNS always charged). */
  dnsFeeToPaySek: number;
  /** entryFeeToPaySek + dnsFeeToPaySek */
  totalToPaySek: number;
  /** Raw fee sum (all imported rows). */
  feeSek: number;
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
  if (value === "ok" || value === "dnf" || value === "entered") return value;
  return "dns";
}

export function isEventExempt(data: DnsFeeTrackerData, eventId: string): boolean {
  return data.exemptEventIds.includes(eventId);
}

export function isRowInSweden(row: DnsFeeRow): boolean {
  return row.inSweden !== false;
}

/**
 * Youth (≤16) and junior (17–20) classes by ClassShortName / klassnamn.
 * Based on entered class, not birth year. Open adult classes are not exempt.
 */
export function isYouthOrJuniorClass(className: string): boolean {
  const raw = className.trim();
  if (!raw || raw === "–" || raw === "-") return false;

  const normalized = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (/inskol/.test(normalized)) return true;
  if (/\bungdom\b/.test(normalized)) return true;
  if (/\bjunior\b/.test(normalized)) return true;
  if (/\bu[\s-]*(1[0-6]|17|18|19|20)\b/.test(normalized)) return true;

  // D16, H20, DH14, HD17-20, H16E, D 18, …
  const age = normalized.match(
    /(?:^|[^a-z0-9])(?:dh|hd|[dh])\s*(\d{1,2})(?:\s*[-–to]+\s*(\d{1,2}))?/,
  );
  if (!age) return false;

  const from = Number(age[1]);
  const to = age[2] ? Number(age[2]) : from;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  // Whole class band must be within youth/junior (≤20). D17-34 is adult.
  return from >= 1 && from <= 20 && to >= 1 && to <= 20;
}

/** Club pays anmälningsavgift for youth/junior on Swedish events; DNS never waived this way. */
export function isYouthJuniorEntryFeeExempt(row: DnsFeeRow): boolean {
  return isRowInSweden(row) && isYouthOrJuniorClass(row.className);
}

export function isEntryFeeExempt(data: DnsFeeTrackerData, row: DnsFeeRow): boolean {
  return isEventExempt(data, row.eventId) || isYouthJuniorEntryFeeExempt(row);
}

/**
 * Split payable amounts:
 * - Anmälningsavgift: waived for exempt events (OK/entered only) and for
 *   youth/junior classes in Sweden (OK/entered/DNF). DNS never waived.
 * - DNS-kostnad: always payable
 */
export function rowPayableSplit(
  data: DnsFeeTrackerData,
  row: DnsFeeRow,
): { entryFeeToPaySek: number; dnsFeeToPaySek: number } {
  const fee = row.feeSek ?? 0;
  const status = normalizeDnsFeeStatus(row.status);

  if (status === "dns") {
    return { entryFeeToPaySek: 0, dnsFeeToPaySek: fee };
  }

  const youthJunior = isYouthJuniorEntryFeeExempt(row);
  const eventExempt = isEventExempt(data, row.eventId);

  if (status === "dnf") {
    // Manual event exemptions do not cover DNF; youth/junior club policy does.
    return { entryFeeToPaySek: youthJunior ? 0 : fee, dnsFeeToPaySek: 0 };
  }

  // ok | entered
  return { entryFeeToPaySek: eventExempt || youthJunior ? 0 : fee, dnsFeeToPaySek: 0 };
}

/** @deprecated use rowPayableSplit — kept for detail rows */
export function feeToPaySek(data: DnsFeeTrackerData, row: DnsFeeRow): number {
  const split = rowPayableSplit(data, row);
  return split.entryFeeToPaySek + split.dnsFeeToPaySek;
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
      email: member.email ?? null,
      dnsCount: 0,
      startCount: 0,
      entryFeeToPaySek: 0,
      dnsFeeToPaySek: 0,
      totalToPaySek: 0,
      feeSek: 0,
      rows: [],
    });
  }

  for (const row of data.rows) {
    const existing = byPerson.get(row.personId);
    const fee = row.feeSek ?? 0;
    const split = rowPayableSplit(data, row);
    const status = normalizeDnsFeeStatus(row.status);

    if (!existing) {
      byPerson.set(row.personId, {
        personId: row.personId,
        personName: row.personName,
        email: null,
        dnsCount: status === "dns" ? 1 : 0,
        startCount: 1,
        entryFeeToPaySek: split.entryFeeToPaySek,
        dnsFeeToPaySek: split.dnsFeeToPaySek,
        totalToPaySek: split.entryFeeToPaySek + split.dnsFeeToPaySek,
        feeSek: fee,
        rows: [row],
      });
      continue;
    }
    if (!existing.personName && row.personName) {
      existing.personName = row.personName;
    }
    if (status === "dns") existing.dnsCount += 1;
    existing.startCount += 1;
    existing.entryFeeToPaySek += split.entryFeeToPaySek;
    existing.dnsFeeToPaySek += split.dnsFeeToPaySek;
    existing.totalToPaySek += split.entryFeeToPaySek + split.dnsFeeToPaySek;
    existing.feeSek += fee;
    existing.rows.push(row);
  }

  return [...byPerson.values()].sort((a, b) => a.personName.localeCompare(b.personName, "sv"));
}
