"use client";

import { useEffect, useMemo, useState } from "react";

import { PersonNamePicker } from "@/components/PersonNamePicker";
import { assignClassPoints, formatPoints } from "@/lib/mastarnas-points";
import type { MastarnasClass, MastarnasDiscipline, MastarnasStatus } from "@/lib/mastarnas-types";

type DraftRow = {
  localId: string;
  name: string;
  person_key: string;
  place: string;
  status: MastarnasStatus;
  points: string;
};

type EventSummary = {
  id: string;
  discipline_id: string;
  name: string;
  date: string;
};

type Props = {
  year: number;
  classes: MastarnasClass[];
  disciplines: MastarnasDiscipline[];
  events: EventSummary[];
  initialEventId?: string;
  initialClassId?: string;
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

function emptyRow(id = "draft-1"): DraftRow {
  return { localId: id, name: "", person_key: "", place: "", status: "ok", points: "" };
}

function parsePoints(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function MastarnasAdminPanel({
  year,
  classes,
  disciplines,
  events,
  initialEventId,
  initialClassId,
}: Props) {
  const [eventId, setEventId] = useState(initialEventId || events[0]?.id || "");
  const [classId, setClassId] = useState(
    initialClassId || classes.find((item) => item.id !== "okand")?.id || classes[0]?.id || "",
  );
  const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newClass, setNewClass] = useState("");
  const [newClassYouth, setNewClassYouth] = useState(false);
  const [newDiscipline, setNewDiscipline] = useState("");
  const [addExistingDiscipline, setAddExistingDiscipline] = useState("");
  const [eventDate, setEventDate] = useState(
    events.find((item) => item.id === (initialEventId || events[0]?.id))?.date ?? "",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const event = events.find((item) => item.id === eventId);
  const missingDisciplines = disciplines.filter(
    (discipline) => !events.some((item) => item.discipline_id === discipline.id),
  );

  useEffect(() => {
    void loadClassResults(eventId, classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when event/class changes
  }, [eventId, classId]);

  const preview = useMemo(() => {
    const calculated = assignClassPoints(
      rows.map((row) => ({
        id: row.localId,
        place: row.place ? Number(row.place) : null,
        status: row.status,
      })),
    );
    return calculated.map((row, index) => {
      const manual = parsePoints(rows[index]?.points ?? "");
      return manual === null ? row : { ...row, points: manual };
    });
  }, [rows]);

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

  async function loadClassResults(nextEventId: string, nextClassId: string) {
    if (!nextEventId || !nextClassId) {
      setRows([emptyRow("draft-1")]);
      return;
    }
    try {
      const response = await fetch(
        `/api/admin/mastarnas?year=${year}&event_id=${encodeURIComponent(nextEventId)}&class_id=${encodeURIComponent(nextClassId)}`,
      );
      if (!response.ok) {
        setRows([emptyRow("draft-1")]);
        return;
      }
      const data = (await response.json()) as {
        results: {
          id: string;
          name: string;
          person_key: string;
          place: number | null;
          status: MastarnasStatus;
          points: number | null;
        }[];
      };
      if (data.results.length === 0) {
        setRows([emptyRow("draft-1")]);
        return;
      }
      setRows(
        data.results.map((result) => ({
          localId: result.id,
          name: result.name,
          person_key: result.person_key,
          place: result.place ? String(result.place) : "",
          status: result.status,
          points: result.points === null || result.points === undefined ? "" : String(result.points),
        })),
      );
    } catch {
      setRows([emptyRow("draft-1")]);
    }
  }

  function updateRow(index: number, patch: Partial<DraftRow>) {
    const next = [...rows];
    next[index] = { ...rows[index], ...patch };
    setRows(next);
  }

  return (
    <section id="redigera" className="mt-12 scroll-mt-24 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900">Redigera resultat</h2>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="card space-y-3 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void run("Klass tillagd", { action: "addClass", name: newClass, is_youth: newClassYouth });
          }}
        >
          <p className="font-medium text-slate-800">Ny klass</p>
          <input
            className="input-field"
            value={newClass}
            onChange={(event) => setNewClass(event.target.value)}
            placeholder="t.ex. D80"
            required
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={newClassYouth}
              onChange={(event) => setNewClassYouth(event.target.checked)}
            />
            Ungdom (t.o.m. 16 år)
          </label>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            Lägg till klass
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
      </div>

      <div className="card space-y-5 p-5">
        <p className="font-medium text-slate-800">Resultat {year}</p>
        <p className="text-sm text-slate-600">
          Ändra placering, namn eller poäng och spara klassen. Tom poäng = räknas automatiskt efter nuvarande tabell
          (24–10). Ifylld poäng sparas som den är, till exempel historiska tabeller.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Gren</label>
            <select
              className="input-field"
              value={eventId}
              onChange={(event) => {
                const next = event.target.value;
                setEventId(next);
                setEventDate(events.find((item) => item.id === next)?.date ?? "");
              }}
            >
              {events.map((item) => {
                const disc = disciplines.find((d) => d.id === item.discipline_id);
                return (
                  <option key={item.id} value={item.id}>
                    {disc?.name ?? item.name}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Klass</label>
            <select
              className="input-field"
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
              }}
            >
              {classes
                .filter((item) => item.id !== "okand")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Datum</label>
            <input
              type="date"
              className="input-field"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-3">Plac</th>
                <th className="py-2 pr-3">Namn</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Poäng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.localId} className="border-t border-slate-100">
                  <td className="py-2 pr-3 align-top">
                    <input
                      className="input-field w-20"
                      inputMode="numeric"
                      value={row.place}
                      onChange={(event) => updateRow(index, { place: event.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3 align-top min-w-[16rem]">
                    <PersonNamePicker
                      value={row.name}
                      personKey={row.person_key}
                      onChange={({ name, person_key }) => updateRow(index, { name, person_key })}
                    />
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <select
                      className="input-field"
                      value={row.status}
                      onChange={(event) => updateRow(index, { status: event.target.value as MastarnasStatus })}
                    >
                      <option value="ok">Fullföljt</option>
                      <option value="dnf">DNF</option>
                      <option value="dns">DNS</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      className="input-field w-24"
                      inputMode="decimal"
                      placeholder={formatPoints(preview[index]?.points ?? 0)}
                      value={row.points}
                      onChange={(event) => updateRow(index, { points: event.target.value })}
                    />
                  </td>
                  <td className="py-2 align-top">
                    <button
                      type="button"
                      className="text-sm text-slate-500 hover:text-red-700"
                      onClick={() => setRows(rows.filter((item) => item.localId !== row.localId))}
                    >
                      Ta bort
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium"
            onClick={() => setRows([...rows, emptyRow(crypto.randomUUID())])}
          >
            Lägg till rad
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium"
            disabled={isSaving || !event}
            onClick={() =>
              void run("Datum sparat", {
                action: "upsertEvent",
                year,
                discipline_id: event?.discipline_id,
                date: eventDate,
              })
            }
          >
            Spara datum
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={isSaving || !event}
            onClick={() =>
              void run("Resultat sparade", {
                action: "saveResults",
                year,
                event_id: eventId,
                class_id: classId,
                results: rows
                  .filter((row) => row.name.trim())
                  .map((row) => ({
                    name: row.name,
                    person_key: row.person_key,
                    place: row.place ? Number(row.place) : null,
                    status: row.status,
                    points: parsePoints(row.points),
                  })),
              })
            }
          >
            {isSaving ? "Sparar…" : "Spara klassresultat"}
          </button>
        </div>
      </div>
    </section>
  );
}
