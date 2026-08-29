"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { ResolvedResultRow } from "@/lib/data";
import type { ResultRow } from "@/lib/types";
import { ResultTimeCell } from "@/components/ResultTimeCell";

const COLUMNS = [
  { key: "place", label: "Plac" },
  { key: "name", label: "Namn" },
  { key: "class_name", label: "Klass" },
  { key: "time", label: "Tid" },
  { key: "status", label: "Status" },
] as const;

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

function sortByPlace(a: ResultRow, b: ResultRow): number {
  return compareNullable(a.place, b.place, (left, right) => left - right);
}

function rowLinkKey(row: ResultRow | ResolvedResultRow): string {
  return "resolved_person_key" in row ? row.resolved_person_key : row.person_key;
}

function rowDisplayName(row: ResultRow | ResolvedResultRow): string {
  return "resolved_name" in row ? row.resolved_name : row.name;
}

function groupRowsByClass(rows: (ResultRow | ResolvedResultRow)[]): { className: string; rows: (ResultRow | ResolvedResultRow)[] }[] {
  const groups = new Map<string, ResultRow[]>();

  for (const row of rows) {
    const className = row.class_name?.trim() || "–";
    const existing = groups.get(className) ?? [];
    existing.push(row);
    groups.set(className, existing);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "sv"))
    .map(([className, classRows]) => ({
      className,
      rows: [...classRows].sort(sortByPlace),
    }));
}

export function ParsedResultsTable({ rows }: { rows: ResultRow[] | ResolvedResultRow[] }) {
  const groupedRows = useMemo(() => groupRowsByClass(rows), [rows]);

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
              {COLUMNS.map(({ label }) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((group, groupIndex) => (
              <GroupRows key={group.className} group={group} isFirst={groupIndex === 0} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupRows({
  group,
  isFirst,
}: {
  group: { className: string; rows: ResultRow[] };
  isFirst: boolean;
}) {
  return (
    <>
      {!isFirst ? (
        <tr aria-hidden="true">
          <td colSpan={COLUMNS.length} className="border-t-2 border-slate-200 bg-slate-50/50 p-0 h-1" />
        </tr>
      ) : null}
      <tr className="bg-slate-50/80">
        <td
          colSpan={COLUMNS.length}
          className="py-2 text-xs font-semibold uppercase tracking-wider text-brand-700"
        >
          {group.className}
        </td>
      </tr>
      {group.rows.map((row, index) => (
        <tr key={`${group.className}-${rowLinkKey(row)}-${row.place}-${index}`}>
          <td className="font-medium text-slate-700">{row.place ?? "–"}</td>
          <td>
            <Link href={`/person/${rowLinkKey(row)}`} className="link-brand">
              {rowDisplayName(row)}
            </Link>
          </td>
          <td className="text-slate-600">{row.class_name ?? "–"}</td>
          <td className="font-mono text-sm text-slate-700">
            <ResultTimeCell time={row.time} />
          </td>
          <td className="text-slate-500">{row.status ?? "–"}</td>
        </tr>
      ))}
    </>
  );
}
