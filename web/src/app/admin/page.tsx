import type { Metadata } from "next";

import { AdminEventForm } from "@/components/AdminEventForm";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { PageHeader } from "@/components/PageHeader";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { getDeployMode, getEventTypes } from "@/lib/admin-data";

export const metadata: Metadata = {
  title: "Admin — Resultatbanken",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const configured = isAdminConfigured();
  const authenticated = configured && (await isAdminAuthenticated());
  const eventTypes = authenticated ? getEventTypes() : [];
  const deployMode = getDeployMode();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Admin"
        title="Lägg till resultat"
        description="Registrera nya träningar och ladda upp resultatfil. Sidan är lösenordsskyddad."
      />

      {!configured ? (
        <div className="card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">Admin är inte aktiverat.</p>
          <p className="mt-2">
            Sätt miljövariabeln <code className="rounded bg-white/70 px-1.5 py-0.5">ADMIN_PASSWORD</code> i{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5">web/.env.local</code> och starta om dev-servern.
          </p>
        </div>
      ) : authenticated ? (
        <>
          {deployMode === "git" ? (
            <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
              <p className="font-medium">Git-deploy aktivt</p>
              <p className="mt-1">
                Nya resultat committas till GitHub och Netlify bygger om sajten automatiskt.
              </p>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-medium">Lokalt läge</p>
              <p className="mt-1">
                Filer sparas direkt i <code className="rounded bg-white px-1 py-0.5">data/</code>. Sätt{" "}
                <code className="rounded bg-white px-1 py-0.5">GITHUB_TOKEN</code> och{" "}
                <code className="rounded bg-white px-1 py-0.5">GITHUB_REPO</code> på Netlify för produktion.
              </p>
            </div>
          )}
          <AdminEventForm eventTypes={eventTypes} />
        </>
      ) : (
        <AdminLoginForm />
      )}
    </main>
  );
}
