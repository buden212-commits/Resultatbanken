export type DnsFeeStatus = "ok" | "dns" | "dnf" | "entered";

/** One Eventor EntryFee applied on an entry (may be several per start). */
export type DnsFeePart = {
  entryFeeId: string;
  name: string;
  amountSek: number;
  /**
   * Beskattningsgrundande when Eventor sets taxIncluded="Y".
   * null when the attribute is missing.
   */
  taxable: boolean | null;
  /** Eventor attribute entryFeeType / type (often "elite" / "normal"). */
  entryFeeType: string | null;
  /** ValidToDate from Eventor (YYYY-MM-DD), if present. */
  validToDate: string | null;
};

export type DnsFeeRow = {
  personId: string;
  personName: string;
  eventId: string;
  eventName: string;
  date: string;
  className: string;
  /** ok / dns / dnf from results, or entered if no result yet */
  status: DnsFeeStatus;
  /** Full entry fee in SEK from Eventor (sum of fees). */
  feeSek: number | null;
  /** Breakdown of Eventor EntryFee rows that make up feeSek. */
  fees?: DnsFeePart[] | null;
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
  /** Ordinarie / grundavgift att betala (efter undantag). */
  entryFeeToPaySek: number;
  /** Efteranmälan att betala (efter undantag). */
  lateFeeToPaySek: number;
  /** Övriga tillägg att betala (efter undantag). */
  otherFeeToPaySek: number;
  /** DNS-kostnad att betala (DNS always charged). */
  dnsFeeToPaySek: number;
  /** entryFeeToPaySek + lateFeeToPaySek + otherFeeToPaySek + dnsFeeToPaySek */
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

export function normalizeDnsFeePart(value: unknown): DnsFeePart | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const entryFeeId = String(raw.entryFeeId ?? "").trim();
  const amountSek = Number(raw.amountSek);
  if (!entryFeeId || !Number.isFinite(amountSek)) return null;
  return {
    entryFeeId,
    name: String(raw.name ?? "").trim() || `Avgift ${entryFeeId}`,
    amountSek,
    taxable: typeof raw.taxable === "boolean" ? raw.taxable : null,
    entryFeeType:
      typeof raw.entryFeeType === "string" && raw.entryFeeType.trim()
        ? raw.entryFeeType.trim()
        : null,
    validToDate:
      typeof raw.validToDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw.validToDate)
        ? raw.validToDate.slice(0, 10)
        : null,
  };
}

/**
 * Best-effort label from Eventor fee name / taxable flag.
 * Eventor has no enum for fee kinds — organizers use free-text names.
 */
export function describeDnsFeePart(part: DnsFeePart): string {
  switch (classifyDnsFeeKind(part)) {
    case "ordinary":
      return "Ordinarie / grundavgift";
    case "late":
      return "Efteranmälan";
    case "other":
      return "Övrigt tillägg";
  }
}

export type DnsFeeKind = "ordinary" | "late" | "other";

/**
 * Ordinary = anmälningsavgift; late = efteranmälan; other = övriga tillägg.
 * Classification is name-based (plus taxable=false → other as fallback).
 */
export function classifyDnsFeeKind(part: DnsFeePart): DnsFeeKind {
  const lower = part.name
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  if (/efteranm|direktam|tavlingsdagen|efter.?anmal/.test(lower)) {
    return "late";
  }
  if (/beskattningsfri|skoter|omkostnad|tillaegg|tillagg|hogkvalitativ/.test(lower)) {
    return "other";
  }
  if (part.taxable === false) {
    return "other";
  }
  return "ordinary";
}

/** Split raw fee into ordinary / late / other (legacy rows without fees → all ordinary). */
export function splitFeeAmounts(row: DnsFeeRow): {
  ordinarySek: number;
  lateSek: number;
  otherSek: number;
} {
  const fees = row.fees ?? [];
  if (fees.length === 0) {
    return { ordinarySek: row.feeSek ?? 0, lateSek: 0, otherSek: 0 };
  }
  let ordinarySek = 0;
  let lateSek = 0;
  let otherSek = 0;
  for (const fee of fees) {
    const kind = classifyDnsFeeKind(fee);
    if (kind === "ordinary") ordinarySek += fee.amountSek;
    else if (kind === "late") lateSek += fee.amountSek;
    else otherSek += fee.amountSek;
  }
  return { ordinarySek, lateSek, otherSek };
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
 * - Anmälan (ordinarie/grundavgift): waived for exempt events (OK/entered) and
 *   youth/junior in Sweden (OK/entered/DNF)
 * - Efteranmälan / övriga tillägg: same waiver rules as anmälan
 * - DNS: always full feeSek (never waived)
 */
export function rowPayableSplit(
  data: DnsFeeTrackerData,
  row: DnsFeeRow,
): {
  entryFeeToPaySek: number;
  lateFeeToPaySek: number;
  otherFeeToPaySek: number;
  dnsFeeToPaySek: number;
} {
  const fee = row.feeSek ?? 0;
  const { ordinarySek, lateSek, otherSek } = splitFeeAmounts(row);
  const status = normalizeDnsFeeStatus(row.status);
  const zero = {
    entryFeeToPaySek: 0,
    lateFeeToPaySek: 0,
    otherFeeToPaySek: 0,
    dnsFeeToPaySek: 0,
  };

  if (status === "dns") {
    return { ...zero, dnsFeeToPaySek: fee };
  }

  const youthJunior = isYouthJuniorEntryFeeExempt(row);
  const eventExempt = isEventExempt(data, row.eventId);

  if (status === "dnf") {
    // Manual event exemptions do not cover DNF; youth/junior club policy does.
    if (youthJunior) return zero;
    return {
      entryFeeToPaySek: ordinarySek,
      lateFeeToPaySek: lateSek,
      otherFeeToPaySek: otherSek,
      dnsFeeToPaySek: 0,
    };
  }

  // ok | entered
  if (eventExempt || youthJunior) return zero;
  return {
    entryFeeToPaySek: ordinarySek,
    lateFeeToPaySek: lateSek,
    otherFeeToPaySek: otherSek,
    dnsFeeToPaySek: 0,
  };
}

/** @deprecated use rowPayableSplit — kept for detail rows */
export function feeToPaySek(data: DnsFeeTrackerData, row: DnsFeeRow): number {
  const split = rowPayableSplit(data, row);
  return (
    split.entryFeeToPaySek +
    split.lateFeeToPaySek +
    split.otherFeeToPaySek +
    split.dnsFeeToPaySek
  );
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
      lateFeeToPaySek: 0,
      otherFeeToPaySek: 0,
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
    const rowTotal =
      split.entryFeeToPaySek +
      split.lateFeeToPaySek +
      split.otherFeeToPaySek +
      split.dnsFeeToPaySek;

    if (!existing) {
      byPerson.set(row.personId, {
        personId: row.personId,
        personName: row.personName,
        email: null,
        dnsCount: status === "dns" ? 1 : 0,
        startCount: 1,
        entryFeeToPaySek: split.entryFeeToPaySek,
        lateFeeToPaySek: split.lateFeeToPaySek,
        otherFeeToPaySek: split.otherFeeToPaySek,
        dnsFeeToPaySek: split.dnsFeeToPaySek,
        totalToPaySek: rowTotal,
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
    existing.lateFeeToPaySek += split.lateFeeToPaySek;
    existing.otherFeeToPaySek += split.otherFeeToPaySek;
    existing.dnsFeeToPaySek += split.dnsFeeToPaySek;
    existing.totalToPaySek += rowTotal;
    existing.feeSek += fee;
    existing.rows.push(row);
  }

  return [...byPerson.values()].sort((a, b) => a.personName.localeCompare(b.personName, "sv"));
}
