"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { parseTimeToSeconds } from "@/lib/time";
import type { PersonResult } from "@/lib/types";

type SortKey = "date" | "event_name" | "location" | "class_name" | "place" | "time";
type SortDirection = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Datum" },
  { key: "event_name", label: "Tävling" },
  { key: "location", label: "Plats" },
  { key: "class_name", label: "Klass" },
  { key: "place", label: "Plac" },
  { key: "time", label: "Tid" },
];

function formatDate(date: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Date(`${date}T12:00:00`).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function defaultDirection(key: SortKey): SortDirection {
  return key === "date" ? "desc" : "asc";
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

function compareResults(a: PersonResult, b: PersonResult, key: SortKey): number {
  switch (key) {
    case "date":
      return (a.date ?? "").localeCompare(b.date ?? "");
    case "event_name":
      return (a.event_name || "").localeCompare(b.event_name || "", "sv");
    case "location":
      return (a.location || "").localeCompare(b.location || "", "sv");
    case "class_name":
      return (a.class_name || "").localeCompare(b.class_name || "", "sv");
    case "place":
      return compareNullable(a.place, b.place, (left, right) => left - right);
    case "time": {
      const aSeconds = a.status || !a.time ? null : parseTimeToSeconds(a.time);
      const bSeconds = b.status || !b.time ? null : parseTimeToSeconds(b.time);
      return compareNullable(aSeconds, bSeconds, (left, right) => left - right);
    }
  }
}

export function PersonResultsTable({ results }: { results: PersonResult[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedResults = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    return [...results].sort(
      (a, b) => compareResults(a, b, sortKey) * directionMultiplier,
    );
  }, [results, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(defaultDirection(key));
  }

  return (
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
          {sortedResults.map((result) => (
            <tr key={`${result.event_id}-${result.class_name}-${result.place}-${result.time}`}>
              <td className="whitespace-nowrap text-slate-600">
                {result.date ? formatDate(result.date) : "–"}
              </td>
              <td>
                <Link href={`/resultat/${result.event_id}`} className="link-brand">
                  {result.event_name || `Resultat ${result.event_id}`}
                </Link>
              </td>
              <td className="text-slate-600">{result.location || "–"}</td>
              <td className="text-slate-600">{result.class_name || "–"}</td>
              <td className="font-medium">{result.place ?? "–"}</td>
              <td className="font-mono text-sm">{result.status ?? result.time ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
