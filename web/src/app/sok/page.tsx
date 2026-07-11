import type { Metadata } from "next";
import Link from "next/link";

import { PersonResultList } from "@/components/EventList";
import { PageHeader } from "@/components/PageHeader";
import { PersonSearchForm } from "@/components/PersonSearchForm";
import { searchPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Sök person — Resultatbanken",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const results = searchPeople(q);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Personsök"
        title="Hitta dina resultat"
        description="Sök på för- eller efternamn bland alla orienterare i arkivet."
      />

      <div className="card relative z-30 max-w-2xl overflow-visible p-4 sm:p-5">
        <PersonSearchForm initialQuery={q} />
      </div>

      {q ? (
        <section className="mt-10">
          <p className="mb-4 text-sm font-medium text-slate-500">
            {results.length} träff{results.length === 1 ? "" : "ar"} för &quot;{q}&quot;
          </p>
          {results.length > 0 ? (
            <PersonResultList people={results} />
          ) : (
            <div className="card px-6 py-12 text-center">
              <p className="text-lg font-medium text-slate-700">Ingen person hittades</p>
              <p className="mt-2 text-sm text-slate-500">
                Prova ett kortare sökord eller kontrollera stavningen.
              </p>
              <Link href="/resultat" className="link-brand mt-4 inline-block text-sm">
                Bläddra alla resultat istället
              </Link>
            </div>
          )}
        </section>
      ) : (
        <div className="mt-10 card px-6 py-10 text-center text-slate-500">
          <p>Börja skriva ett namn ovan för att söka i arkivet.</p>
        </div>
      )}
    </main>
  );
}
