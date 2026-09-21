import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import type { DnsFeeMember, DnsFeeTrackerData } from "./dns-fee-types";

export const DELTAGARE_COOKIE = "deltagare_session";

/** Dev default — override with DELTAGARE_PASSWORD in production. */
const DEFAULT_PASSWORD = "EjStart";

function getPassword(): string {
  return process.env.DELTAGARE_PASSWORD?.trim() || DEFAULT_PASSWORD;
}

export function verifyDeltagarePassword(password: string): boolean {
  const expected = getPassword();
  try {
    const a = Buffer.from(password, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createDeltagareToken(personId: string): string {
  const id = String(personId);
  const sig = createHmac("sha256", getPassword()).update(`resultatbanken-deltagare:${id}`).digest("hex");
  return `${id}.${sig}`;
}

export function verifyDeltagareToken(token: string | undefined): string | null {
  if (!token || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const personId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!personId || !sig) return null;
  const expected = createHmac("sha256", getPassword())
    .update(`resultatbanken-deltagare:${personId}`)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return personId;
  } catch {
    return null;
  }
}

export async function getDeltagarePersonId(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyDeltagareToken(cookieStore.get(DELTAGARE_COOKIE)?.value);
}

export function normalizePersonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type DeltagareCandidate = {
  personId: string;
  personName: string;
  email: string | null;
};

function memberIndex(data: DnsFeeTrackerData): Map<string, DnsFeeMember> {
  const map = new Map<string, DnsFeeMember>();
  for (const member of data.members ?? []) {
    map.set(member.personId, member);
  }
  for (const row of data.rows) {
    if (!map.has(row.personId)) {
      map.set(row.personId, {
        personId: row.personId,
        personName: row.personName,
        email: null,
      });
    }
  }
  return map;
}

export function findDeltagareByEmail(
  data: DnsFeeTrackerData,
  email: string,
): DeltagareCandidate | null {
  const needle = normalizeEmail(email);
  if (!needle.includes("@")) return null;

  for (const member of memberIndex(data).values()) {
    if (member.email && normalizeEmail(member.email) === needle) {
      return {
        personId: member.personId,
        personName: member.personName,
        email: member.email,
      };
    }
  }
  return null;
}

export function findDeltagareByName(
  data: DnsFeeTrackerData,
  name: string,
): DeltagareCandidate[] {
  const needle = normalizePersonName(name);
  if (!needle) return [];

  const hits: DeltagareCandidate[] = [];
  for (const member of memberIndex(data).values()) {
    if (normalizePersonName(member.personName) === needle) {
      hits.push({
        personId: member.personId,
        personName: member.personName,
        email: member.email,
      });
    }
  }
  return hits.sort((a, b) => a.personName.localeCompare(b.personName, "sv"));
}

export function findDeltagareByPersonId(
  data: DnsFeeTrackerData,
  personId: string,
): DeltagareCandidate | null {
  const member = memberIndex(data).get(String(personId));
  if (!member) return null;
  return {
    personId: member.personId,
    personName: member.personName,
    email: member.email,
  };
}
