import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnmalanLoginForm } from "@/components/DnsFeeAdminPanel";
import { DnsFeeEventPanel } from "@/components/DnsFeeEventPanel";
import { BackLink, PageHeader } from "@/components/PageHeader";
import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import { getDnsFeeEventDetail } from "@/lib/dns-fee-types";

export const metadata: Metadata = {
  title: "Tävling — Koll på anmälan — Resultatbanken",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function KollAnmalanEventPage({ params }: Props) {
  const { eventId } = await params;
  const authenticated = await isAnmalanAuthenticated();

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
        <BackLink href="/koll-anmalan">Koll på anmälan</BackLink>
        <div className="mt-6">
          <PageHeader eyebrow="Administration" title="Tävling" />
          <p className="mb-4 text-center text-sm text-slate-600">
            Sidan är lösenordsskyddad. Logga in för att se tävlingens deltagare och avgifter.
          </p>
          <AnmalanLoginForm />
        </div>
      </main>
    );
  }

  const data = await loadDnsFeeTracker();
  const event = getDnsFeeEventDetail(data, eventId);
  if (!event) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <BackLink href="/koll-anmalan">Koll på anmälan</BackLink>
      <div className="mt-6">
        <PageHeader
          eyebrow="Koll på anmälan"
          title={event.eventName}
          description={`${event.date} · ${event.totals.people} deltagare. Undanta avgifter per person eller sätt tävlingen som borttagen.`}
        />
        <div className="mt-8">
          <DnsFeeEventPanel
            initial={{
              year: data.year,
              exemptEventIds: data.exemptEventIds,
              removedEventIds: data.removedEventIds ?? [],
              eventWaivers: data.eventWaivers ?? [],
              exemptFeeNames: data.exemptFeeNames ?? [],
              manualExemptions: data.manualExemptions ?? [],
              event,
            }}
          />
        </div>
      </div>
    </main>
  );
}
