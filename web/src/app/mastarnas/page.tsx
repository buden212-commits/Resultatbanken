import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { PageHeader } from "@/components/PageHeader";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { getLatestMastarnasYear } from "@/lib/mastarnas";

export const metadata: Metadata = {
  title: "Mästarnas Mästare — Resultatbanken",
};

export default async function MastarnasIndexPage() {
  const latest = getLatestMastarnasYear();
  if (latest) {
    redirect(`/mastarnas/${latest}`);
  }

  const canEdit = isAdminConfigured() && (await isAdminAuthenticated());

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <PageHeader
        eyebrow="Klubbmästerskap"
        title="Mästarnas Mästare"
        description="IFK Mora OK:s totala klubbmästerskap över nio grenar. Inget år är publicerat ännu."
      />
      {canEdit ? (
        <p className="text-sm text-slate-600">Logga in är redan gjort — skapa ett år under administration när du öppnar ett år.</p>
      ) : isAdminConfigured() ? (
        <AdminLoginForm />
      ) : null}
    </main>
  );
}
