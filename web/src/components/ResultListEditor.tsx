"use client";

import { useMemo, useState } from "react";

import { PersonNamePicker } from "@/components/PersonNamePicker";
import type { ResultRow } from "@/lib/types";

type DraftRow = {
  localId: string;
  name: string;
  person_key: string;
  club: string;
  class_name: string;
  place: string;
  time: string;
  status: string;
};

type Props = {
  eventId: number;
  initialRows: ResultRow[];
  onCancel: () => void;
};

const STATUS_OPTIONS = [
  { value: "", label: "Fullföljt" },
  { value: "dns", label: "DNS" },
  { value: "dnf", label: "DNF" },
  { value: "felst", label: "Felst" },
  { value: "deltagit", label: "Deltagit" },
] as const;

function emptyDraftRow(): DraftRow {
  return {
    localId: crypto.randomUUID(),
    name: "",
    person_key: "",
    club: "",
    class_name: "",
    place: "",
    time: "",
    status: "",
  };
}

function toDraftRows(rows: ResultRow[]): DraftRow[] {
  if (rows.length === 0) {
    return [emptyDraftRow()];
  }

  return [...rows]
    .sort((a, b) => {
      const classCompare = (a.class_name ?? "").localeCompare(b.class_name ?? "", "sv");
      if (classCompare !== 0) {
        return classCompare;
      }
      const placeA = a.place ?? 9999;
      const placeB = b.place ?? 9999;
      if (placeA !== placeB) {
        return placeA - placeB;
      }
      return a.name.localeCompare(b.name, "sv");
    })
    .map((row) => ({
      localId: crypto.randomUUID(),
      name: row.name,
      person_key: row.person_key,
      club: row.club ?? "",
      class_name: row.class_name ?? "",
      place: row.place != null ? String(row.place) : "",
      time: row.time ?? "",
      status: row.status ?? "",
    }));
}

function parsePlace(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function ResultListEditor({ eventId, initialRows, onCancel }: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() => toDraftRows(initialRows));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const classSuggestions = useMemo(() => {
    const values = new Set<string>();
    for (const row of rows) {
      const trimmed = row.class_name.trim();
      if (trimmed) {
        values.add(trimmed);
      }
    }
    return [...values].sort((a, b) => a.localeCompare(b, "sv"));
  }, [rows]);

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((current) => {
      const next = [...current];
      const currentRow = current[index]!;
      const merged = { ...currentRow, ...patch };

      if (patch.status !== undefined && patch.status) {
        merged.place = "";
        merged.time = "";
      }

      next[index] = merged;
      return next;
    });
  }

  async function onSave() {
    const payload = rows
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        person_key: row.person_key.trim() || undefined,
        club: row.club.trim() || null,
        class_name: row.class_name.trim() || null,
        place: parsePlace(row.place),
        time: row.time.trim() || null,
        status: row.status.trim() || null,
      }));

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          results: payload,
        }),
      });

      const body = await response.text();
      let data: {
        error?: string;
        rowCount?: number;
        deploy?: { ok: boolean; message: string };
      };

      try {
        data = body ? (JSON.parse(body) as typeof data) : {};
      } catch {
        setError("Ogiltigt svar från servern.");
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Kunde inte spara resultatlistan.");
        return;
      }

      setMessage(
        data.deploy?.ok
          ? `Sparat ${data.rowCount ?? payload.length} deltagare. Sidan laddas om…`
          : (data.deploy?.message ?? "Sparat."),
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-10 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Redigera deltagare</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ändra tider och namn, lägg till eller ta bort deltagare. Tomma namnrader sparas inte.
          </p>
        </div>
        <button
          type="button"
          className="text-sm font-medium text-slate-500 hover:text-brand-800"
          onClick={onCancel}
          disabled={isSaving}
        >
          Avbryt
        </button>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <div className="table-shell overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Plac</th>
              <th>Namn</th>
              <th>Klubb</th>
              <th>Klass</th>
              <th>Tid</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Åtgärder</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const hasStatus = Boolean(row.status);
              return (
                <tr key={row.localId}>
                  <td className="align-top">
                    <input
                      className="input-field w-16"
                      inputMode="numeric"
                      value={row.place}
                      disabled={hasStatus || isSaving}
                      onChange={(event) => updateRow(index, { place: event.target.value })}
                      aria-label="Placering"
                    />
                  </td>
                  <td className="align-top min-w-[14rem]">
                    <PersonNamePicker
                      value={row.name}
                      personKey={row.person_key}
                      onChange={({ name, person_key }) => updateRow(index, { name, person_key })}
                    />
                  </td>
                  <td className="align-top">
                    <input
                      className="input-field w-36"
                      value={row.club}
                      disabled={isSaving}
                      onChange={(event) => updateRow(index, { club: event.target.value })}
                      aria-label="Klubb"
                    />
                  </td>
                  <td className="align-top">
                    <input
                      className="input-field w-28"
                      list={`result-class-suggestions-${eventId}`}
                      value={row.class_name}
                      disabled={isSaving}
                      onChange={(event) => updateRow(index, { class_name: event.target.value })}
                      aria-label="Klass"
                    />
                  </td>
                  <td className="align-top">
                    <input
                      className="input-field w-28 font-mono text-sm"
                      value={row.time}
                      disabled={hasStatus || isSaving}
                      placeholder="t.ex. 45:30"
                      onChange={(event) => updateRow(index, { time: event.target.value })}
                      aria-label="Tid"
                    />
                  </td>
                  <td className="align-top">
                    <select
                      className="input-field"
                      value={row.status}
                      disabled={isSaving}
                      onChange={(event) => updateRow(index, { status: event.target.value })}
                      aria-label="Status"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value || "ok"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="align-top">
                    <button
                      type="button"
                      className="mt-2 text-sm text-slate-500 hover:text-red-700"
                      disabled={isSaving}
                      onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    >
                      Ta bort
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <datalist id={`result-class-suggestions-${eventId}`}>
        {classSuggestions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          disabled={isSaving}
          onClick={() => setRows((current) => [...current, emptyDraftRow()])}
        >
          Lägg till deltagare
        </button>
        <button type="button" className="btn-primary" disabled={isSaving} onClick={() => void onSave()}>
          {isSaving ? "Sparar…" : "Spara resultatlistan"}
        </button>
      </div>
    </section>
  );
}
