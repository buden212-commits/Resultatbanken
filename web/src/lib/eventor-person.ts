/**
 * Eventor club members + person result lists for the personal dashboard.
 */

import {
  eventorEventUrl,
  eventorGet,
  fetchOrganisationId,
  isEventorConfigured,
} from "./eventor";
import { parseTimeToSeconds } from "./time";

const CLASSIFICATION_TYPE: Record<string, string> = {
  "1": "Mästerskap",
  "2": "Nationell tävling",
  "3": "Distriktstävling",
  "4": "Närtävling",
  "5": "Klubbtävling",
  "6": "Internationell tävling",
};

const DISTANCE_LABEL: Record<string, string> = {
  sprint: "Sprint",
  middle: "Medel",
  long: "Lång",
  ultralong: "Ultralång",
  night: "Natt",
};

type GlobalPersonsCache = typeof globalThis & {
  __rbEventorPersons?: { loadedAt: number; persons: EventorClubPerson[] };
};

export type EventorClubPerson = {
  personId: string;
  given: string;
  family: string;
  displayName: string;
  birthYear: number | null;
};

export type EventorPersonResult = {
  eventId: string;
  eventName: string;
  date: string;
  organizer: string;
  classification: string;
  className: string;
  place: number | null;
  time: string | null;
  timeSeconds: number | null;
  timeDiff: string | null;
  kilometreTime: string | null;
  kilometreTimeSeconds: number | null;
  status: string;
  statusRaw: string;
  distanceKind: string | null;
  startsInClass: number | null;
  eventUrl: string;
  isTeam: boolean;
};

function firstLeaf(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "i");
  return xml.match(re)?.[1]?.trim() ?? "";
}

function splitTopLevel(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(re) ?? [];
}

function attr(xml: string, name: string): string {
  return xml.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1]?.trim() ?? "";
}

function mapStatus(raw: string): string {
  switch (raw) {
    case "OK":
      return "ok";
    case "DidNotStart":
      return "dns";
    case "DidNotFinish":
      return "dnf";
    case "MisPunch":
      return "felst";
    case "Disqualified":
      return "dsq";
    case "OverTime":
      return "ot";
    case "Inactive":
      return "inactive";
    default:
      return raw ? raw.toLowerCase() : "okänd";
  }
}

function mapDistance(raw: string): string | null {
  if (!raw) return null;
  return DISTANCE_LABEL[raw.toLowerCase()] ?? raw;
}

function parseBirthYear(block: string): number | null {
  const date = block.match(/<BirthDate>[\s\S]*?<Date>(\d{4})/i)?.[1];
  if (!date) return null;
  const year = Number(date);
  return Number.isInteger(year) && year > 1900 ? year : null;
}

function parseClubPerson(block: string): EventorClubPerson | null {
  const personId = firstLeaf(block, "PersonId");
  const family = firstLeaf(block, "Family");
  const given = firstLeaf(block, "Given");
  if (!personId || (!family && !given)) return null;
  return {
    personId,
    given,
    family,
    displayName: [given, family].filter(Boolean).join(" "),
    birthYear: parseBirthYear(block),
  };
}

async function loadClubPersons(): Promise<EventorClubPerson[]> {
  const cache = globalThis as GlobalPersonsCache;
  const ttlMs = 60 * 60 * 1000;
  if (cache.__rbEventorPersons && Date.now() - cache.__rbEventorPersons.loadedAt < ttlMs) {
    return cache.__rbEventorPersons.persons;
  }

  const organisationId = await fetchOrganisationId();
  const xml = await eventorGet(`persons/organisations/${organisationId}`);
  const persons = splitTopLevel(xml, "Person")
    .map(parseClubPerson)
    .filter((person): person is EventorClubPerson => Boolean(person))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "sv"));

  cache.__rbEventorPersons = { loadedAt: Date.now(), persons };
  return persons;
}

export async function searchClubPersons(query: string, limit = 20): Promise<EventorClubPerson[]> {
  if (!isEventorConfigured()) {
    throw new Error("Eventor är inte konfigurerat.");
  }
  const q = query.trim().toLocaleLowerCase("sv");
  if (q.length < 2) {
    throw new Error("Skriv minst 2 tecken.");
  }
  const persons = await loadClubPersons();
  const tokens = q.split(/\s+/).filter(Boolean);
  return persons
    .filter((person) => {
      const hay = `${person.displayName} ${person.family} ${person.given}`.toLocaleLowerCase("sv");
      return tokens.every((token) => hay.includes(token));
    })
    .slice(0, limit);
}

export async function getClubPerson(personId: string): Promise<EventorClubPerson | null> {
  const persons = await loadClubPersons();
  return persons.find((person) => person.personId === personId) ?? null;
}

function parseResultFields(resultXml: string): {
  place: number | null;
  time: string | null;
  timeDiff: string | null;
  kilometreTime: string | null;
  statusRaw: string;
} {
  const placeRaw = firstLeaf(resultXml, "ResultPosition");
  const place = placeRaw ? Number(placeRaw) : null;
  return {
    place: Number.isInteger(place) && place! > 0 ? place : null,
    time: firstLeaf(resultXml, "Time") || null,
    timeDiff: firstLeaf(resultXml, "TimeDiff") || null,
    kilometreTime: firstLeaf(resultXml, "KilometreTime") || null,
    statusRaw: attr(resultXml, "value") || firstLeaf(resultXml, "CompetitorStatus") || "OK",
  };
}

function extractPersonResultsFromList(listXml: string, personId: string): EventorPersonResult[] {
  const eventBlock = listXml.match(/<Event\b[\s\S]*?<\/Event>/i)?.[0] ?? "";
  const eventId = firstLeaf(eventBlock, "EventId");
  if (!eventId) return [];

  const eventName = firstLeaf(eventBlock, "Name") || `Eventor ${eventId}`;
  const date =
    eventBlock.match(/<StartDate>[\s\S]*?<Date>([^<]+)<\/Date>/i)?.[1]?.trim().slice(0, 10) ||
    firstLeaf(eventBlock, "Date").slice(0, 10);
  const organizer =
    eventBlock.match(/<Organiser>[\s\S]*?<Name>([^<]+)<\/Name>/i)?.[1]?.trim() || "";
  const classificationId = firstLeaf(eventBlock, "EventClassificationId");
  const distanceKind = mapDistance(
    eventBlock.match(/<WRSInfo>[\s\S]*?<Distance>([^<]+)<\/Distance>/i)?.[1]?.trim() ?? "",
  );

  const rows: EventorPersonResult[] = [];
  const classResults = splitTopLevel(listXml, "ClassResult");

  for (const classResult of classResults) {
    const className =
      firstLeaf(classResult, "ClassShortName") || firstLeaf(classResult, "Name") || "–";
    const startsRaw = attr(classResult, "numberOfStarts") || attr(classResult, "noOfStarts");
    const startsInClass = startsRaw ? Number(startsRaw) : null;

    for (const personResult of splitTopLevel(classResult, "PersonResult")) {
      if (firstLeaf(personResult, "PersonId") !== personId) continue;

      const raceResults = splitTopLevel(personResult, "RaceResult");
      const directResult = personResult.match(/<Result\b[\s\S]*?<\/Result>/i)?.[0];
      const resultBlocks =
        raceResults.length > 0
          ? raceResults.map((race) => race.match(/<Result\b[\s\S]*?<\/Result>/i)?.[0] ?? race)
          : directResult
            ? [directResult]
            : [];

      for (const resultXml of resultBlocks) {
        const fields = parseResultFields(resultXml);
        // CompetitorStatus is an empty element with value= attr — parseResultFields may miss it
        const statusRaw =
          resultXml.match(/<CompetitorStatus[^>]*value="([^"]+)"/i)?.[1] || fields.statusRaw;
        const time = fields.time;
        const kilometreTime = fields.kilometreTime;
        rows.push({
          eventId,
          eventName,
          date,
          organizer,
          classification: CLASSIFICATION_TYPE[classificationId] || "Tävling",
          className,
          place: fields.place,
          time,
          timeSeconds: time ? parseTimeToSeconds(time) : null,
          timeDiff: fields.timeDiff,
          kilometreTime,
          kilometreTimeSeconds: kilometreTime ? parseTimeToSeconds(kilometreTime) : null,
          status: mapStatus(statusRaw),
          statusRaw,
          distanceKind,
          startsInClass: Number.isInteger(startsInClass) ? startsInClass : null,
          eventUrl: eventorEventUrl(eventId),
          isTeam: false,
        });
      }
    }

    for (const teamMember of splitTopLevel(classResult, "TeamMemberResult")) {
      if (firstLeaf(teamMember, "PersonId") !== personId) continue;
      const statusRaw =
        teamMember.match(/<CompetitorStatus[^>]*value="([^"]+)"/i)?.[1] || "OK";
      const placeRaw =
        teamMember.match(/<Position[^>]*type="Leg"[^>]*>(\d+)<\/Position>/i)?.[1] ||
        firstLeaf(teamMember.match(/<OverallResult>[\s\S]*?<\/OverallResult>/i)?.[0] ?? "", "ResultPosition");
      const place = placeRaw ? Number(placeRaw) : null;
      const time = firstLeaf(teamMember, "Time") || null;
      rows.push({
        eventId,
        eventName,
        date,
        organizer,
        classification: CLASSIFICATION_TYPE[classificationId] || "Tävling",
        className,
        place: Number.isInteger(place) && place! > 0 ? place : null,
        time,
        timeSeconds: time ? parseTimeToSeconds(time) : null,
        timeDiff: null,
        kilometreTime: null,
        kilometreTimeSeconds: null,
        status: mapStatus(statusRaw),
        statusRaw,
        distanceKind,
        startsInClass: Number.isInteger(startsInClass) ? startsInClass : null,
        eventUrl: eventorEventUrl(eventId),
        isTeam: true,
      });
    }
  }

  return rows;
}

export async function fetchPersonResults(
  personId: string,
  fromDate = "1990-01-01",
  toDate = "2099-12-31",
): Promise<EventorPersonResult[]> {
  if (!isEventorConfigured()) {
    throw new Error("Eventor är inte konfigurerat.");
  }
  if (!/^\d+$/.test(personId)) {
    throw new Error("Ogiltigt person-id.");
  }

  const xml = await eventorGet("results/person", {
    personId,
    fromDate: `${fromDate} 00:00:00`,
    toDate: `${toDate} 23:59:59`,
  });

  const rows = splitTopLevel(xml, "ResultList").flatMap((list) =>
    extractPersonResultsFromList(list, personId),
  );

  rows.sort((a, b) => {
    if (a.date === b.date) return a.eventName.localeCompare(b.eventName, "sv");
    return a.date < b.date ? 1 : -1;
  });

  return rows;
}
