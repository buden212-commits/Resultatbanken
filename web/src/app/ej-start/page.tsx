import type { Metadata } from "next";

import { DeltagareDnsPanel } from "@/components/DeltagareDnsPanel";
import { PageHeader } from "@/components/PageHeader";
import {
  findDeltagareByPersonId,
  getDeltagarePersonId,
} from "@/lib/deltagare-auth";
import { loadDnsFeeTracker } from "@/lib/dns-fee-store";
import { normalizeDnsFeeStatus } from "@/lib/dns-fee-types";

export const metadata: Metadata = {
  title: "Ej start — Resultatbanken",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EjStartPage() {
  const personId = await getDeltagarePersonId();

  let initial = null;
  if (personId) {
    const data = await loadDnsFeeTracker();
    const person = findDeltagareByPersonId(data, personId);
    if (person) {
      initial = {
        year: data.year,
        person,
        dnsRows: data.rows
          .filter(
            (row) => row.personId === personId && normalizeDnsFeeStatus(row.status) === "dns",
          )
          .sort((a, b) => {
            if (a.date !== b.date) return a.date < b.date ? 1 : -1;
            return a.eventName.localeCompare(b.eventName, "sv");
          })
          .map((row) => ({
            eventId: row.eventId,
            eventName: row.eventName,
            date: row.date,
            className: row.className,
            feeSek: row.feeSek,
            dnsReason: row.dnsReason ?? null,
            dnsReasonAt: row.dnsReasonAt ?? null,
          })),
      };
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <PageHeader
        eyebrow="IFK Mora OK"
        title="Orsak till ej start"
        description="Logga in med e-post och deltagarlösenord för att ange varför du inte startade. Saknas e-postträff kan du ange namn i stället."
      />
      <div className="mt-8">
        <DeltagareDnsPanel initial={initial} />
      </div>
    </main>
  );
}
