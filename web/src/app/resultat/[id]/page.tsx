import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/PageHeader";
import { ParsedResultsTable } from "@/components/ParsedResultsTable";
import { TypeBadge } from "@/components/ui";
import { findContentFile, formatDate, getEvent, getResolvedResultsForEvent } from "@/lib/data";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = getEvent(Number(id));
  return {
    title: event ? `${event.name} — Resultatbanken` : "Resultat saknas",
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const eventId = Number(id);
  const event = getEvent(eventId);

  if (!event) {
    notFound();
  }

  const content = findContentFile(eventId);
  const parsedRows = getResolvedResultsForEvent(eventId);
  const title = event.name || event.type || `Resultat ${event.id}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <BackLink href="/resultat">Alla resultat</BackLink>

      <header className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <time className="text-sm font-medium text-brand-700">{formatDate(event.date)}</time>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {title}
              </h1>
            </div>
            {event.type ? <TypeBadge label={event.type} /> : null}
          </div>
        </div>

        <dl className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plats</dt>
            <dd className="mt-1 text-base font-medium text-slate-800">{event.location || "–"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Arrangör</dt>
            <dd className="mt-1 text-base font-medium text-slate-800">{event.organizer || "–"}</dd>
          </div>
        </dl>

        {event.free_text ? (
          <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:px-8">
            <p className="text-sm leading-relaxed text-slate-600">{event.free_text}</p>
          </div>
        ) : null}
      </header>

      <ParsedResultsTable rows={parsedRows} />

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Resultatfil</h2>
        {!content ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Resultatfil saknas för detta event.
          </div>
        ) : content.ext === ".pdf" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50">
            <iframe
              src={`/api/content/${eventId}`}
              title={event.name}
              className="h-[80vh] w-full"
            />
          </div>
        ) : content.ext === ".html" || content.ext === ".txt" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50">
            <iframe
              src={`/api/content/${eventId}`}
              title={event.name}
              className="min-h-[40vh] w-full"
            />
          </div>
        ) : content.ext === ".jpeg" || content.ext === ".jpg" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/content/${eventId}`}
            alt={event.name}
            className="max-w-full rounded-2xl border border-slate-200/80 shadow-lg"
          />
        ) : (
          <a href={`/api/content/${eventId}`} className="btn-primary">
            Ladda ner {event.result_file || "fil"}
          </a>
        )}
      </section>
    </main>
  );
}
