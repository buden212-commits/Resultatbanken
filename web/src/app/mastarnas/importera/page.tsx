import type { Metadata } from "next";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { MastarnasImportGuide } from "@/components/MastarnasImportGuide";
import { BackLink, PageHeader } from "@/components/PageHeader";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { readMastarnasData } from "@/lib/mastarnas";

type Props = {
  searchParams: Promise<{ event?: string; year?: string }>;
};

export const metadata: Metadata = {
  title: "Läs in till Mästarnas Mästare — Resultatbanken",
  robots: { index: false, follow: false },
};

export default async function MastarnasImportPage({ searchParams }: Props) {
  const { event, year } = await searchParams;
  const configured = isAdminConfigured();
  const authenticated = configured && (await isAdminAuthenticated());

  const data = readMastarnasData();
  const years = [...data.seasons.map((item) => item.year)].sort((a, b) => b - a);
  const initialEventId = event ? Number(event) : undefined;
  const initialYear = year ? Number(year) : years[0];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <BackLink href={initialYear ? `/mastarnas/${initialYear}` : "/mastarnas"}>Mästarnas Mästare</BackLink>
      <div className="mt-6">
        <PageHeader
          eyebrow="Administrera"
          title="Läs in resultat till Mästarnas Mästare"
          description={
            authenticated
              ? "Välj ett resultat från arkivet, översätt klasserna och spara i rätt gren. Poäng räknas automatiskt efter placering i varje MM-klass."
              : "Välj ett resultat från arkivet, översätt klasserna och spara i rätt gren. Sidan är lösenordsskyddad. Lösenordet är Hemus."
          }
        />
      </div>
      {!configured ? (
        <div className="mt-8 card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">Inläsning är inte aktiverad.</p>
          <p className="mt-2">Sätt ADMIN_PASSWORD i miljövariabler för att kunna läsa in resultat.</p>
        </div>
      ) : authenticated ? (
        <MastarnasImportGuide
          years={years}
          classes={data.classes}
          disciplines={data.disciplines}
          initialEventId={Number.isInteger(initialEventId) ? initialEventId : undefined}
          initialYear={Number.isInteger(initialYear) ? initialYear : undefined}
        />
      ) : (
        <div className="mt-8">
          <p className="mb-4 text-sm text-slate-600">Logga in med samma lösenord som på Ladda upp.</p>
          <AdminLoginForm />
        </div>
      )}
    </main>
  );
}
