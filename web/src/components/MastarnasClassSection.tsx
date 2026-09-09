"use client";

import Link from "next/link";
import { useState } from "react";

import {
  ClassResultsDraftTable,
  draftRowsToPayload,
  emptyClassDraftRow,
  sortClassDraftRows,
  type ClassDraftRow,
} from "@/components/ClassResultsDraftTable";
import { formatPoints, resultPoints } from "@/lib/mastarnas-points";
import type { MastarnasResult } from "@/lib/mastarnas-types";

function statusLabel(status: string): string {
  if (status === "dnf") {
    return "DNF";
  }
  if (status === "dns") {
    return "DNS";
  }
  return "";
}

function toDraft(results: MastarnasResult[]): ClassDraftRow[] {
  if (results.length === 0) {
    return [emptyClassDraftRow()];
  }
  return sortClassDraftRows(
    results.map((result) => ({
      localId: result.id,
      name: result.name,
      person_key: result.person_key,
      place: result.place ? String(result.place) : "",
      status: result.status,
      points: result.points === null || result.points === undefined ? "" : String(result.points),
    })),
  );
}

export function MastarnasClassSection({
  year,
  eventId,
  classId,
  className,
  results,
  canEdit,
  startEditing = false,
  onDismiss,
}: {
  year: number;
  eventId: string;
  classId: string;
  className: string;
  results: MastarnasResult[];
  canEdit: boolean;
  startEditing?: boolean;
  onDismiss?: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [rows, setRows] = useState<ClassDraftRow[]>(() => toDraft(results));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const points = resultPoints(results);

  function beginEditing() {
    setRows(toDraft(results));
    setError("");
    setEditing(true);
  }

  async function save() {
    const payload = draftRowsToPayload(rows, true);
    if (payload.length === 0) {
      setError("Lägg till minst en deltagare.");
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/mastarnas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveResults",
          year,
          event_id: eventId,
          class_id: classId,
          results: payload,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Kunde inte spara.");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara.");
      setIsSaving(false);
    }
  }

  return (
    <section className={editing ? "card space-y-0 p-5" : "table-shell overflow-x-auto"}>
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
        <h3 className="text-base font-semibold text-slate-900">{className}</h3>
        {canEdit ? (
          editing ? (
            <button
              type="button"
              className="text-sm font-medium text-slate-500 hover:text-brand-800"
              onClick={() => {
                setError("");
                if (results.length === 0 && onDismiss) {
                  onDismiss();
                  return;
                }
                setEditing(false);
                setRows(toDraft(results));
              }}
            >
              Avbryt
            </button>
          ) : (
            <button
              type="button"
              className="text-sm font-medium text-brand-700 hover:text-brand-900"
              onClick={beginEditing}
            >
              Redigera klassen
            </button>
          )
        ) : null}
      </div>

      {editing ? (
        <div className="space-y-4 px-1 pb-3">
          <p className="text-sm text-slate-600">
            Dra namnen för att ändra ordning — poängen räknas om. DNS ger 0 p, DNF 10 p.
          </p>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <ClassResultsDraftTable rows={rows} onChange={setRows} />
          <button type="button" className="btn-primary" disabled={isSaving} onClick={() => void save()}>
            {isSaving ? "Sparar…" : "Spara klassen"}
          </button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Plac</th>
              <th>Namn</th>
              <th>Status</th>
              <th>Poäng</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td className="font-medium text-slate-700">{result.place ?? ""}</td>
                <td>
                  <Link href={`/person/${encodeURIComponent(result.person_key)}`} className="link-brand">
                    {result.name}
                  </Link>
                </td>
                <td className="text-slate-500">{statusLabel(result.status)}</td>
                <td className="font-mono tabular-nums">{formatPoints(points.get(result.id) ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
