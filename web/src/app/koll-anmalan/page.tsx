import type { Metadata } from "next";

import { AnmalanLoginForm, DnsFeeAdminPanel } from "@/components/DnsFeeAdminPanel";
import { PageHeader } from "@/components/PageHeader";
import { isAnmalanAuthenticated } from "@/lib/anmalan-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import {
  listEventsFromRows,
  summarizeDnsFeesByPerson,
} from "@/lib/dns-fee-types";

export const metadata: Metadata = {
  title: "Koll på anmälan — Resultatbanken",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function KollAnmalanPage() {
  const authenticated = await isAnmalanAuthenticated();

  let initial = null;
  if (authenticated) {
    const data = await loadDnsFeeTracker();
    const people = summarizeDnsFeesByPerson(data);
    initial = {
      year: data.year,
      importedAt: data.importedAt,
      exemptEventIds: data.exemptEventIds,
      people,
      events: listEventsFromRows(data.rows),
      totals: {
        people: people.length,
        dnsStarts: people.reduce((sum, row) => sum + row.dnsCount, 0),
        starts: people.reduce((sum, row) => sum + row.startCount, 0),
        entryFeeToPaySek: people.reduce((sum, row) => sum + row.entryFeeToPaySek, 0),
        dnsFeeToPaySek: people.reduce((sum, row) => sum + row.dnsFeeToPaySek, 0),
        totalToPaySek: people.reduce((sum, row) => sum + row.totalToPaySek, 0),
      },
    };
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <PageHeader
        eyebrow="Administration"
        title="Koll på anmälan"
        description="Anmälningsavgifter och DNS under 2026 för IFK Mora OK — summerat per deltagare. Stafetter ingår inte."
      />

      <div className="mt-8">
        {authenticated && initial ? (
          <DnsFeeAdminPanel initial={initial} />
        ) : (
          <div>
            <p className="mb-4 text-center text-sm text-slate-600">
              Sidan är lösenordsskyddad. Logga in för att se och uppdatera avgifter för DNS/DNF.
            </p>
            <AnmalanLoginForm />
          </div>
        )}
      </div>
    </main>
  );
}
