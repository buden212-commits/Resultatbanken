"use client";

import Link from "next/link";
import { useState } from "react";

import type { MastarnasDiscipline } from "@/lib/mastarnas-types";

type EventSummary = {
  id: string;
  discipline_id: string;
  name: string;
  date: string;
};

type Props = {
  year: number;
  disciplines: MastarnasDiscipline[];
  events: EventSummary[];
};

async function postAction(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/mastarnas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { error?: string; deploy?: { ok: boolean; message: string } };
  if (!response.ok) {
    throw new Error(data.error ?? "Kunde inte spara.");
  }
  return data;
}

export function MastarnasAdminPanel({ year, disciplines, events }: Props) {
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newDiscipline, setNewDiscipline] = useState("");
  const [addExistingDiscipline, setAddExistingDiscipline] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const missingDisciplines = disciplines.filter(
    (discipline) => !events.some((item) => item.discipline_id === discipline.id),
  );

  async function run(label: string, body: Record<string, unknown>) {
    setError("");
    setMessage("");
    setIsSaving(true);
    try {
      const data = await postAction(body);
      setMessage(data.deploy?.message ?? label);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id="redigera" className="mt-12 scroll-mt-24 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900">Administration</h2>
        <button
          type="button"
          className="text-sm font-medium text-slate-500 hover:text-brand-700"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            window.location.reload();
          }}
        >
          Logga ut
        </button>
      </div>

      <div className="card space-y-3 p-5">
        <p className="font-medium text-slate-800">Läs in från resultatarkivet</p>
        <p className="text-sm text-slate-600">
          Hämta ett KM eller annat resultat och översätt klasserna till Mästarnas Mästare. Poäng räknas automatiskt.
        </p>
        <Link href={`/mastarnas/importera?year=${year}`} className="btn-primary inline-flex">
          Öppna inläsningsguiden
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <form
        className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void run("År skapat", { action: "createSeason", year: Number(newYear) });
        }}
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Nytt år</label>
          <input
            className="input-field"
            type="number"
            min={1990}
            max={2100}
            value={newYear}
            onChange={(event) => setNewYear(event.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={isSaving}>
          Skapa år
        </button>
      </form>

      <div className="card space-y-4 p-5">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run("Gren tillagd", {
              action: "addDiscipline",
              name: newDiscipline,
              year,
            });
          }}
        >
          <p className="font-medium text-slate-800">Ny gren {year}</p>
          <input
            className="input-field"
            value={newDiscipline}
            onChange={(event) => setNewDiscipline(event.target.value)}
            placeholder="t.ex. Precisionsorientering"
            required
          />
          <button type="submit" className="btn-primary" disabled={isSaving}>
            Lägg till ny gren
          </button>
        </form>
        {missingDisciplines.length > 0 ? (
          <form
            className="space-y-3 border-t border-slate-100 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run("Gren tillagd i året", {
                action: "upsertEvent",
                year,
                discipline_id: addExistingDiscipline,
              });
            }}
          >
            <p className="text-sm font-medium text-slate-700">Befintlig gren som saknas {year}</p>
            <select
              className="input-field"
              value={addExistingDiscipline}
              onChange={(event) => setAddExistingDiscipline(event.target.value)}
              required
            >
              <option value="">Välj gren</option>
              {missingDisciplines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={isSaving || !addExistingDiscipline}>
              Lägg till i {year}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
