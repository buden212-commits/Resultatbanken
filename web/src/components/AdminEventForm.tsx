"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Props = {
  eventTypes: string[];
};

type SubmitResult = {
  id: number;
  url: string;
  deploy: { mode: "local" | "git"; ok: boolean; message: string };
};

export function AdminEventForm({ eventTypes }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as SubmitResult & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Kunde inte spara resultatet.");
        return;
      }

      setResult(data);
      form.reset();
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-600">Du är inloggad som administratör.</p>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="text-sm font-medium text-slate-500 transition hover:text-brand-700"
        >
          Logga ut
        </button>
      </div>

      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">Resultatet sparades med id {result.id}.</p>
          <p className="mt-1">
            <Link href={result.url} className="link-brand">
              Visa resultatsidan →
            </Link>
          </p>
          <p className={`mt-2 ${result.deploy.ok ? "text-emerald-800" : "text-amber-800"}`}>
            {result.deploy.message}
          </p>
          {result.deploy.mode === "git" ? (
            <p className="mt-2 text-emerald-800">
              Personsökningen uppdateras när Netlify-bygget är klart (index byggs om automatiskt).
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="card space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Träningsnamn <span className="text-red-500">*</span>
            </label>
            <input id="name" name="name" className="input-field" required />
          </div>

          <div>
            <label htmlFor="type" className="mb-1.5 block text-sm font-medium text-slate-700">
              Typ
            </label>
            <input
              id="type"
              name="type"
              list="event-types"
              className="input-field"
              placeholder="t.ex. Tränings-OL"
            />
            <datalist id="event-types">
              {eventTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-slate-700">
              Datum <span className="text-red-500">*</span>
            </label>
            <input id="date" name="date" type="date" className="input-field" required />
          </div>

          <div>
            <label htmlFor="location" className="mb-1.5 block text-sm font-medium text-slate-700">
              Plats
            </label>
            <input id="location" name="location" className="input-field" />
          </div>

          <div>
            <label htmlFor="organizer" className="mb-1.5 block text-sm font-medium text-slate-700">
              Arrangör
            </label>
            <input id="organizer" name="organizer" className="input-field" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="free_text" className="mb-1.5 block text-sm font-medium text-slate-700">
              Fritext
            </label>
            <textarea
              id="free_text"
              name="free_text"
              rows={3}
              className="input-field resize-y"
              placeholder="Väder, antal startande, kommentarer…"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="file" className="mb-1.5 block text-sm font-medium text-slate-700">
              Resultatfil <span className="text-red-500">*</span>
            </label>
            <input
              id="file"
              name="file"
              type="file"
              className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
              accept=".pdf,.html,.htm,.txt,.xls,.xlsx,.ods,.doc,.docx,.rtf,.jpeg,.jpg"
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              PDF, HTML, text, Excel, Word eller bild. Filen sparas som {"{id}.filändelse"}.
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? "Sparar…" : "Spara resultat"}
        </button>
      </form>
    </div>
  );
}
