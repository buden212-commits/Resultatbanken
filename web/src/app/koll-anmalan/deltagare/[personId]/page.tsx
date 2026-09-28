import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnmalanLoginForm } from "@/components/DnsFeeAdminPanel";
import { DnsFeePersonPanel } from "@/components/DnsFeePersonPanel";
import { BackLink, PageHeader } from "@/components/PageHeader";
import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import { getDnsFeePersonDetail } from "@/lib/dns-fee-types";

export const metadata: Metadata = {
  title: "Deltagare — Koll på anmälan — Resultatbanken",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ personId: string }>;
};

export default async function KollAnmalanPersonPage({ params }: Props) {
  const { personId } = await params;
  const authenticated = await isAnmalanAuthenticated();

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
        <BackLink href="/koll-anmalan">Koll på anmälan</BackLink>
        <div className="mt-6">
          <PageHeader eyebrow="Administration" title="Deltagare" />
          <p className="mb-4 text-center text-sm text-slate-600">
            Sidan är lösenordsskyddad. Logga in för att se deltagarens avgifter.
          </p>
          <AnmalanLoginForm />
        </div>
      </main>
    );
  }

  const data = await loadDnsFeeTracker();
  const person = getDnsFeePersonDetail(data, personId);
  if (!person) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <BackLink href="/koll-anmalan">Koll på anmälan</BackLink>
      <div className="mt-6">
        <PageHeader
          eyebrow="Koll på anmälan"
          title={person.personName}
          description="Avgifter per tävling. Undanta kostnader per start eller öppna en tävling för mer."
        />
        <div className="mt-8">
          <DnsFeePersonPanel
            initial={{
              year: data.year,
              exemptEventIds: data.exemptEventIds,
              removedEventIds: data.removedEventIds ?? [],
              eventWaivers: data.eventWaivers ?? [],
              exemptFeeNames: data.exemptFeeNames ?? [],
              manualExemptions: data.manualExemptions ?? [],
              person,
            }}
          />
        </div>
      </div>
    </main>
  );
}
