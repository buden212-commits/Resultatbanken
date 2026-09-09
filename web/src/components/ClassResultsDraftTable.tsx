"use client";

import { useMemo, useState } from "react";

import { PersonNamePicker } from "@/components/PersonNamePicker";
import { assignClassPoints, formatPoints } from "@/lib/mastarnas-points";
import type { MastarnasStatus } from "@/lib/mastarnas-types";

export type ClassDraftRow = {
  localId: string;
  name: string;
  person_key: string;
  place: string;
  status: MastarnasStatus;
  points: string;
};

type Props = {
  rows: ClassDraftRow[];
  onChange: (rows: ClassDraftRow[]) => void;
  showManualPoints?: boolean;
};

export function emptyClassDraftRow(): ClassDraftRow {
  return {
    localId: crypto.randomUUID(),
    name: "",
    person_key: "",
    place: "",
    status: "ok",
    points: "",
  };
}

export function sortClassDraftRows(rows: ClassDraftRow[]): ClassDraftRow[] {
  return [...rows].sort((a, b) => {
    const placeA = a.place ? Number(a.place) : 999;
    const placeB = b.place ? Number(b.place) : 999;
    if (placeA !== placeB) {
      return placeA - placeB;
    }
    const rank = (status: MastarnasStatus) => (status === "ok" ? 0 : status === "dnf" ? 1 : 2);
    if (rank(a.status) !== rank(b.status)) {
      return rank(a.status) - rank(b.status);
    }
    return a.name.localeCompare(b.name, "sv");
  });
}

export function assignDraftPlaces(rows: ClassDraftRow[]): ClassDraftRow[] {
  let place = 1;
  return rows.map((row) => {
    if (row.status !== "ok") {
      return { ...row, place: "", points: "" };
    }
    const next = { ...row, place: String(place), points: "" };
    place += 1;
    return next;
  });
}

export function nextDraftPlace(rows: ClassDraftRow[]): number {
  const places = rows.filter((row) => row.status === "ok").map((row) => Number(row.place) || 0);
  return Math.max(0, ...places) + 1;
}

export function moveDraftRow(rows: ClassDraftRow[], from: number, to: number): ClassDraftRow[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) {
    return rows;
  }
  const next = [...rows];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return assignDraftPlaces(next);
}

function parsePoints(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ClassResultsDraftTable({ rows, onChange, showManualPoints = false }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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

  function updateRow(index: number, patch: Partial<ClassDraftRow>) {
    const next = [...rows];
    const current = rows[index]!;
    if (patch.status && patch.status !== "ok") {
      next[index] = { ...current, ...patch, place: "", points: "" };
      onChange(next);
      return;
    }
    if (patch.status === "ok" && current.status !== "ok") {
      next[index] = {
        ...current,
        ...patch,
        place: current.place || String(nextDraftPlace(rows.filter((_, i) => i !== index))),
        points: "",
      };
      onChange(next);
      return;
    }
    next[index] = { ...current, ...patch };
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-visible">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="py-2 pr-2 w-10">
                <span className="sr-only">Flytta</span>
              </th>
              <th className="py-2 pr-3">Plac</th>
              <th className="py-2 pr-3">Namn</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Poäng</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.localId}
                className={`border-t border-slate-100 ${dragIndex === index ? "bg-brand-50" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null) {
                    onChange(moveDraftRow(rows, dragIndex, index));
                  }
                  setDragIndex(null);
                }}
              >
                <td className="py-2 pr-2 align-top">
                  <button
                    type="button"
                    draggable
                    aria-label={`Flytta ${row.name || "rad"}`}
                    title="Dra för att ändra placering"
                    className="mt-2 cursor-grab touch-none rounded-lg px-1.5 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
                    onDragStart={(event) => {
                      setDragIndex(index);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(index));
                    }}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <circle cx="5" cy="3" r="1.2" />
                      <circle cx="11" cy="3" r="1.2" />
                      <circle cx="5" cy="8" r="1.2" />
                      <circle cx="11" cy="8" r="1.2" />
                      <circle cx="5" cy="13" r="1.2" />
                      <circle cx="11" cy="13" r="1.2" />
                    </svg>
                  </button>
                </td>
                <td className="py-2 pr-3 align-top">
                  {showManualPoints ? (
                    <input
                      className="input-field w-20"
                      inputMode="numeric"
                      value={row.place}
                      onChange={(event) => updateRow(index, { place: event.target.value })}
                    />
                  ) : (
                    <span className="mt-2 inline-block w-8 font-medium tabular-nums text-slate-700">
                      {row.place}
                    </span>
                  )}
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
                  {showManualPoints ? (
                    <input
                      className="input-field w-24"
                      inputMode="decimal"
                      placeholder={formatPoints(preview[index]?.points ?? 0)}
                      value={row.points}
                      onChange={(event) => updateRow(index, { points: event.target.value })}
                    />
                  ) : (
                    <span className="mt-2 inline-block font-mono tabular-nums text-slate-800">
                      {formatPoints(preview[index]?.points ?? 0)}
                    </span>
                  )}
                </td>
                <td className="py-2 align-top">
                  <button
                    type="button"
                    className="mt-2 text-sm text-slate-500 hover:text-red-700"
                    onClick={() => onChange(rows.filter((item) => item.localId !== row.localId))}
                  >
                    Ta bort
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        onClick={() =>
          onChange([
            ...rows,
            { ...emptyClassDraftRow(), place: String(nextDraftPlace(rows)) },
          ])
        }
      >
        Lägg till deltagare
      </button>
    </div>
  );
}

export function draftRowsToPayload(rows: ClassDraftRow[], useManualPoints: boolean) {
  return rows
    .filter((row) => row.name.trim())
    .map((row) => ({
      name: row.name,
      person_key: row.person_key,
      place: row.place ? Number(row.place) : null,
      status: row.status,
      points: useManualPoints ? parsePoints(row.points) : null,
    }));
}
