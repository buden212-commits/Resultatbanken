import { AdminEventForm } from "@/components/AdminEventForm";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { PageHeader } from "@/components/PageHeader";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { getDeployMode, getEventTypes } from "@/lib/admin-data";

export async function UploadResultPage() {
  const configured = isAdminConfigured();
  const authenticated = configured && (await isAdminAuthenticated());
  const eventTypes = authenticated ? getEventTypes() : [];
  const deployMode = getDeployMode();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Registrera"
        title="Ladda upp resultat"
        description="Lägg till en ny träning med resultatfil. Sidan är lösenordsskyddad."
      />

      {!configured ? (
        <div className="card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">Uppladdning är inte aktiverad.</p>
          <p className="mt-2">Kontakta administratören om du behöver lägga till resultat.</p>
        </div>
      ) : authenticated ? (
        <>
          {deployMode === "git" ? (
            <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
              <p className="font-medium">Git-deploy aktivt</p>
              <p className="mt-1">
                Nya resultat committas till GitHub och Vercel bygger om sajten automatiskt.
              </p>
            </div>
          ) : null}
          <AdminEventForm eventTypes={eventTypes} />
        </>
      ) : (
        <AdminLoginForm />
      )}
    </main>
  );
}
