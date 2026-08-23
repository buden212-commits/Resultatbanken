import type { Metadata } from "next";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { PersonAliasForm } from "@/components/PersonAliasForm";
import { PageHeader } from "@/components/PageHeader";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { getPeopleIndex } from "@/lib/data";
import { getPersonAliasGroupsForAdmin } from "@/lib/person-alias-data";

export const metadata: Metadata = {
  title: "Koppla namn — Resultatbanken",
  robots: { index: false, follow: false },
};

export default async function KopplaNamnPage() {
  const configured = isAdminConfigured();
  const authenticated = configured && (await isAdminAuthenticated());

  const people = getPeopleIndex()
    .map((person) => ({
      person_key: person.person_key,
      display_name: person.display_name,
      result_count: person.result_count,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "sv"));

  const existingGroups = authenticated ? getPersonAliasGroupsForAdmin() : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Administration"
        title="Koppla namn"
        description={
          authenticated
            ? "Slå ihop olika stavningar till ett namn. Grunddatat ändras inte — bara en kopplingstabell."
            : "Slå ihop olika stavningar till ett namn. Sidan är lösenordsskyddad. Lösenordet är Hemus."
        }
      />

      {!configured ? (
        <div className="card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">Funktionen är inte aktiverad.</p>
          <p className="mt-2">Kontakta administratören.</p>
        </div>
      ) : authenticated ? (
        <PersonAliasForm people={people} existingGroups={existingGroups} />
      ) : (
        <AdminLoginForm />
      )}
    </main>
  );
}
