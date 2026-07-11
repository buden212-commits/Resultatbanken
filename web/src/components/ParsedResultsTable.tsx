"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { parseTimeToSeconds } from "@/lib/time";
import type { ResultRow } from "@/lib/types";

type SortKey = "place" | "name" | "class_name" | "time" | "status";
type SortDirection = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "place", label: "Plac" },
  { key: "name", label: "Namn" },
  { key: "class_name", label: "Klass" },
  { key: "time", label: "Tid" },
  { key: "status", label: "Status" },
];

function defaultDirection(key: SortKey): SortDirection {
  return key === "place" || key === "time" ? "asc" : "asc";
}

function compareNullable<T>(a: T | null, b: T | null, compare: (left: T, right: T) => number): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return compare(a, b);
}

function compareRows(a: ResultRow, b: ResultRow, key: SortKey): number {
  switch (key) {
    case "place":
      return compareNullable(a.place, b.place, (left, right) => left - right);
    case "name":
      return a.name.localeCompare(b.name, "sv");
    case "class_name":
      return (a.class_name || "").localeCompare(b.class_name || "", "sv");
    case "time": {
      const aSeconds = a.time ? parseTimeToSeconds(a.time) : null;
      const bSeconds = b.time ? parseTimeToSeconds(b.time) : null;
      return compareNullable(aSeconds, bSeconds, (left, right) => left - right);
    }
    case "status":
      return (a.status || "").localeCompare(b.status || "", "sv");
  }
}

export function ParsedResultsTable({ rows }: { rows: ResultRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("place");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedRows = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compareRows(a, b, sortKey) * directionMultiplier);
  }, [rows, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(defaultDirection(key));
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-bold text-slate-900">Deltagare</h2>
      <div className="table-shell overflow-x-auto">
        <table>
          <thead>
            <tr>
              {COLUMNS.map(({ key, label }) => {
                const isActive = sortKey === key;
                const ariaSort = isActive
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";

                return (
                  <th key={key} aria-sort={ariaSort}>
                    <button
                      type="button"
                      onClick={() => handleSort(key)}
                      className={`inline-flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left font-[inherit] tracking-[inherit] transition-colors hover:text-brand-600 ${
                        isActive ? "text-brand-600" : ""
                      }`}
                    >
                      <span>{label}</span>
                      {isActive ? (
                        <span className="text-brand-500" aria-hidden="true">
                          {sortDirection === "asc" ? "↑" : "↓"}
                        </span>
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={`${row.person_key}-${index}`}>
                <td className="font-medium text-slate-700">{row.place ?? "–"}</td>
                <td>
                  <Link href={`/person/${row.person_key}`} className="link-brand">
                    {row.name}
                  </Link>
                </td>
                <td className="text-slate-600">{row.class_name ?? "–"}</td>
                <td className="font-mono text-sm text-slate-700">{row.time ?? "–"}</td>
                <td className="text-slate-500">{row.status ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
