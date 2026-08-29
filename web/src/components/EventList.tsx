import Link from "next/link";

import type { Event } from "@/lib/types";
import { formatDate } from "@/lib/data";
import { resolveEventType } from "@/lib/type-aliases";

import { TypeBadge } from "./ui";

function shortDate(date: string): { day: string; month: string; year: string } {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { day: "–", month: "", year: "" };
  }
  const parsed = new Date(`${date}T12:00:00`);
  return {
    day: parsed.toLocaleDateString("sv-SE", { day: "numeric" }),
    month: parsed.toLocaleDateString("sv-SE", { month: "short" }).replace(".", ""),
    year: parsed.toLocaleDateString("sv-SE", { year: "numeric" }),
  };
}

export function EventList({
  events,
  eventIdsWithUnreasonableTimes,
}: {
  events: Event[];
  eventIdsWithUnreasonableTimes?: Set<number>;
}) {
  return (
    <ul className="space-y-3">
      {events.map((event) => {
        const dateParts = shortDate(event.date);
        const title = event.name || event.type || `Resultat ${event.id}`;
        const hasUnreasonableTimes = eventIdsWithUnreasonableTimes?.has(event.id) ?? false;

        return (
          <li key={event.id}>
            <Link
              href={`/resultat/${event.id}`}
              className={`card card-hover group flex gap-4 p-4 sm:gap-5 sm:p-5${
                hasUnreasonableTimes ? " ring-2 ring-red-500 bg-red-50/40" : ""
              }`}
            >
              <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 px-3 py-2 text-center min-w-[3.5rem] group-hover:bg-brand-50">
                <span className="text-lg font-bold leading-none text-slate-900">{dateParts.day}</span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {dateParts.month}
                </span>
                <span className="text-[10px] text-slate-400">{dateParts.year}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-brand-800 sm:text-lg">
                    {title}
                  </h2>
                  {event.type ? <TypeBadge label={resolveEventType(event.type)} /> : null}
                </div>

                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  {event.location ? (
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" />
                      </svg>
                      {event.location}
                    </span>
                  ) : null}
                  {event.organizer ? <span>{event.organizer}</span> : null}
                </p>

                {event.free_text ? (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">{event.free_text}</p>
                ) : null}
              </div>

              <svg
                className="hidden h-5 w-5 shrink-0 self-center text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 sm:block"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PersonResultList({
  people,
}: {
  people: Array<{
    person_key: string;
    display_name: string;
    result_count: number;
    first_date: string | null;
    last_date: string | null;
  }>;
}) {
  return (
    <ul className="space-y-2">
      {people.map((person) => (
        <li key={person.person_key}>
          <Link
            href={`/person/${person.person_key}`}
            className="card card-hover flex items-center justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="font-semibold text-slate-900">{person.display_name}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {person.result_count} resultat
                {person.first_date && person.last_date
                  ? ` · ${person.first_date.slice(0, 4)}–${person.last_date.slice(0, 4)}`
                  : ""}
              </p>
            </div>
            <span className="badge">{person.result_count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
