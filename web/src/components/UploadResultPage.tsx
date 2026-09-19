import { AdminEventForm } from "@/components/AdminEventForm";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { EventorImportForm } from "@/components/EventorImportForm";
import { PageHeader } from "@/components/PageHeader";
import { UploadFormatHelp } from "@/components/UploadFormatHelp";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { getEventTypes } from "@/lib/admin-data";
import { isEventorConfigured } from "@/lib/eventor";

export async function UploadResultPage() {
  const configured = isAdminConfigured();
  const authenticated = configured && (await isAdminAuthenticated());
  const eventTypes = authenticated ? getEventTypes() : [];
  const eventorConfigured = isEventorConfigured();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10 md:py-14">
      <PageHeader
        eyebrow="Registrera"
        title="Ladda upp resultat"
        description={
          authenticated
            ? "Lägg till en ny träning med resultatfil, eller importera från Eventor."
            : "Lägg till en ny träning med resultatfil. Sidan är lösenordsskyddad. Lösenordet är Hemus."
        }
      />

      <div className="mt-8">
        <UploadFormatHelp />
      </div>

      {!configured ? (
        <div className="card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-medium">Uppladdning är inte aktiverad.</p>
          <p className="mt-2">Kontakta administratören om du behöver lägga till resultat.</p>
        </div>
      ) : authenticated ? (
        <div className="mt-8 space-y-10">
          <EventorImportForm eventTypes={eventTypes} eventorConfigured={eventorConfigured} />
          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Ladda upp fil manuellt</h2>
            <AdminEventForm eventTypes={eventTypes} />
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <AdminLoginForm />
        </div>
      )}
    </main>
  );
}
