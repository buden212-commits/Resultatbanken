import type { Metadata } from "next";

import { EventList } from "@/components/EventList";
import { PageHeader } from "@/components/PageHeader";
import { getEventIdsWithUnreasonableTimes, getEvents } from "@/lib/data";

export const metadata: Metadata = {
  title: "Alla resultat — Resultatbanken",
};

export default function ResultsPage() {
  const events = getEvents();
  const eventIdsWithUnreasonableTimes = getEventIdsWithUnreasonableTimes();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Arkiv"
        title="Alla resultat"
        description={`${events.length} träningar och tävlingar — sorterade med nyast först.`}
      />
      <EventList
        events={events}
        eventIdsWithUnreasonableTimes={eventIdsWithUnreasonableTimes}
      />
    </main>
  );
}
