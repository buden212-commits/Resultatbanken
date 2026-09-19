/**
 * Eventor API-klient (svenska Eventor).
 * Kräver EVENTOR_API_KEY i miljövariabler / web/.env.local.
 */

const BASE_URL = "https://eventor.orientering.se/api";

const CLASSIFICATION_TYPE: Record<string, string> = {
  "1": "Mästerskap",
  "2": "Nationell tävling",
  "3": "Distriktstävling",
  "4": "Närtävling",
  "5": "Klubbtävling",
  "6": "Internationell tävling",
};

export type EventorSearchScope = "club_entries" | "club_organised" | "all";

export type EventorSearchHit = {
  eventorId: string;
  name: string;
  date: string;
  organizer: string;
  type: string;
  classificationId: string;
};

export type EventorEventMeta = EventorSearchHit & {
  location: string;
};

export type EventorFetchResult = {
  meta: EventorEventMeta;
  xml: string;
  organisationId: string;
};

function getApiKey(): string {
  const key = process.env.EVENTOR_API_KEY?.trim().replace(/^\uFEFF/, "");
  if (!key) {
    throw new Error(
      "EVENTOR_API_KEY saknas. Lägg nyckeln i web/.env.local eller som miljövariabel.",
    );
  }
  return key;
}

async function eventorGet(path: string, params?: Record<string, string>): Promise<string> {
  const url = new URL(`${BASE_URL}/${path.replace(/^\//, "")}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      ApiKey: getApiKey(),
      Accept: "application/xml",
      "User-Agent": "Resultatbanken/1.0 (IFK Mora OK)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`Eventor HTTP ${response.status}: ${body || response.statusText}`);
  }

  return response.text();
}

function firstLeaf(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "i");
  return xml.match(re)?.[1]?.trim() ?? "";
}

function splitTopLevel(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(re) ?? [];
}

function eventBlock(xml: string): string {
  const match = xml.match(/<Event\b[\s\S]*?<\/Event>/i);
  return match?.[0] ?? xml;
}

function parseEventElement(block: string, fallbackId = ""): EventorSearchHit | null {
  const eventorId =
    block.match(/<EventId>(\d+)<\/EventId>/i)?.[1] ||
    block.match(/\beventId="(\d+)"/i)?.[1] ||
    fallbackId;
  const name = firstLeaf(block, "Name");
  const date =
    block.match(/<StartDate>[\s\S]*?<Date>([^<]+)<\/Date>/i)?.[1]?.trim() ||
    firstLeaf(block, "Date");
  const organizer =
    block.match(/<Organiser>[\s\S]*?<Name>([^<]+)<\/Name>/i)?.[1]?.trim() || "";
  const classificationId = firstLeaf(block, "EventClassificationId");

  if (!eventorId || !name) return null;

  return {
    eventorId,
    name: name.trim(),
    date: (date || "").slice(0, 10),
    organizer,
    type: CLASSIFICATION_TYPE[classificationId] || "Tävling",
    classificationId,
  };
}

function parseMetaFromResultList(xml: string, eventorId: string): EventorEventMeta {
  const hit = parseEventElement(eventBlock(xml), eventorId);
  if (!hit || !hit.date) {
    throw new Error(`Kunde inte läsa metadata för Eventor-event ${eventorId}.`);
  }
  return { ...hit, location: "" };
}

export async function fetchOrganisationId(): Promise<string> {
  const xml = await eventorGet("organisation/apiKey");
  const id =
    xml.match(/\borganisationId="(\d+)"/i)?.[1] ||
    xml.match(/<OrganisationId>(\d+)<\/OrganisationId>/i)?.[1] ||
    firstLeaf(xml, "OrganisationId");
  if (!id) {
    throw new Error("Kunde inte läsa organisations-id från Eventor-svaret.");
  }
  return id;
}

export type SearchEventorOptions = {
  fromDate: string;
  toDate: string;
  scope: EventorSearchScope;
  query?: string;
  limit?: number;
};

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("sv");
}

function matchesQuery(hit: EventorSearchHit, query: string): boolean {
  if (!query) return true;
  const q = normalizeQuery(query);
  return (
    hit.name.toLocaleLowerCase("sv").includes(q) ||
    hit.organizer.toLocaleLowerCase("sv").includes(q) ||
    hit.eventorId.includes(q)
  );
}

async function searchEventsByOrganiser(
  organisationId: string,
  fromDate: string,
  toDate: string,
): Promise<EventorSearchHit[]> {
  const xml = await eventorGet("events", {
    fromDate: `${fromDate} 00:00:00`,
    toDate: `${toDate} 23:59:59`,
    organisationIds: organisationId,
  });
  return splitTopLevel(xml, "Event")
    .map((block) => parseEventElement(block))
    .filter((hit): hit is EventorSearchHit => Boolean(hit));
}

async function searchAllEvents(fromDate: string, toDate: string): Promise<EventorSearchHit[]> {
  const xml = await eventorGet("events", {
    fromDate: `${fromDate} 00:00:00`,
    toDate: `${toDate} 23:59:59`,
  });
  return splitTopLevel(xml, "Event")
    .map((block) => parseEventElement(block))
    .filter((hit): hit is EventorSearchHit => Boolean(hit));
}

async function searchEventsWithClubEntries(
  organisationId: string,
  fromDate: string,
  toDate: string,
): Promise<EventorSearchHit[]> {
  const xml = await eventorGet("entries", {
    organisationIds: organisationId,
    fromEventDate: `${fromDate} 00:00:00`,
    toEventDate: `${toDate} 23:59:59`,
    includeEventElement: "true",
  });

  const byId = new Map<string, EventorSearchHit>();
  for (const entry of splitTopLevel(xml, "Entry")) {
    const eventXml = entry.match(/<Event\b[\s\S]*?<\/Event>/i)?.[0];
    if (eventXml) {
      const hit = parseEventElement(eventXml);
      if (hit) byId.set(hit.eventorId, hit);
      continue;
    }
    const eventId = firstLeaf(entry, "EventId");
    if (eventId && !byId.has(eventId)) {
      byId.set(eventId, {
        eventorId: eventId,
        name: `Eventor ${eventId}`,
        date: "",
        organizer: "",
        type: "Tävling",
        classificationId: "",
      });
    }
  }
  return [...byId.values()];
}

/** Sök tävlingar i Eventor för import-UI. */
export async function searchEventorEvents(
  options: SearchEventorOptions,
): Promise<EventorSearchHit[]> {
  const { fromDate, toDate, scope, query = "", limit = 50 } = options;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error("Ogiltigt datum — använd ÅÅÅÅ-MM-DD.");
  }
  if (fromDate > toDate) {
    throw new Error("Från-datum måste vara före till-datum.");
  }

  const q = query.trim();
  if (scope === "all" && q.length < 2) {
    throw new Error("Skriv minst 2 tecken i sökfältet när du söker bland alla tävlingar.");
  }

  const organisationId = await fetchOrganisationId();
  if (!organisationId) {
    throw new Error("Kunde inte läsa organisations-id från API-nyckeln.");
  }

  let hits: EventorSearchHit[];
  if (scope === "club_organised") {
    hits = await searchEventsByOrganiser(organisationId, fromDate, toDate);
  } else if (scope === "club_entries") {
    hits = await searchEventsWithClubEntries(organisationId, fromDate, toDate);
  } else {
    hits = await searchAllEvents(fromDate, toDate);
  }

  hits = hits.filter((hit) => matchesQuery(hit, q));
  hits.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name, "sv")));
  return hits.slice(0, limit);
}

/** Hämtar klubbens resultat + metadata för ett Eventor-event. */
export async function fetchClubResults(eventorId: string): Promise<EventorFetchResult> {
  const organisationId = await fetchOrganisationId();
  if (!organisationId) {
    throw new Error("Kunde inte läsa organisations-id från API-nyckeln.");
  }

  const xml = await eventorGet("results/organisation", {
    eventId: eventorId,
    organisationIds: organisationId,
    includeSplitTimes: "false",
  });

  const meta = parseMetaFromResultList(xml, eventorId);
  return { meta, xml, organisationId };
}

export function eventorEventUrl(eventorId: string): string {
  return `https://eventor.orientering.se/Events/Show/${eventorId}`;
}

export function isEventorConfigured(): boolean {
  return Boolean(process.env.EVENTOR_API_KEY?.trim());
}
