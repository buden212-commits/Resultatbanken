"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ResolvedResultRow } from "@/lib/data";
import type { ResultRow } from "@/lib/types";
import { ResultListEditor } from "@/components/ResultListEditor";
import { ResultTimeEditor } from "@/components/ResultTimeEditor";
import { isUnreasonableTime } from "@/lib/time";

const COLUMNS = [
  { key: "place", label: "Plac" },
  { key: "name", label: "Namn" },
  { key: "club", label: "Klubb" },
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

export function ParsedResultsTable({
  rows,
  editRows,
  eventId,
  canEdit = false,
}: {
  rows: ResultRow[] | ResolvedResultRow[];
  editRows?: ResultRow[];
  eventId?: number;
  canEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const groupedRows = useMemo(() => groupRowsByClass(rows), [rows]);
  const eventHasUnreasonableTimes = useMemo(
    () => rows.some((row) => isUnreasonableTime(row.time)),
    [rows],
  );

  const canEditList = canEdit && eventId !== undefined;
  const editorSource = editRows ?? rows;

  if (editing && canEditList) {
    return (
      <ResultListEditor
        eventId={eventId}
        initialRows={editorSource}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (rows.length === 0) {
    if (!canEditList) {
      return null;
    }

    return (
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Deltagare</h2>
          <button
            type="button"
            className="text-sm font-medium text-brand-700 hover:text-brand-900"
            onClick={() => setEditing(true)}
          >
            Lägg till deltagare
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-600">Inga deltagare indexerade ännu.</p>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Deltagare</h2>
        {canEditList ? (
          <button
            type="button"
            className="text-sm font-medium text-brand-700 hover:text-brand-900"
            onClick={() => setEditing(true)}
          >
            Redigera listan
          </button>
        ) : null}
      </div>
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
              <GroupRows
                key={group.className}
                group={group}
                isFirst={groupIndex === 0}
                eventId={eventId}
                canEdit={canEdit}
                eventHasUnreasonableTimes={eventHasUnreasonableTimes}
              />
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
  eventId,
  canEdit,
  eventHasUnreasonableTimes,
}: {
  group: { className: string; rows: ResultRow[] };
  isFirst: boolean;
  eventId?: number;
  canEdit: boolean;
  eventHasUnreasonableTimes: boolean;
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
      {group.rows.map((row, index) => {
        const unreasonable = isUnreasonableTime(row.time);
        return (
        <tr
          key={`${group.className}-${rowLinkKey(row)}-${row.place}-${index}`}
          className={unreasonable ? "ring-2 ring-inset ring-red-500 bg-red-50/40" : undefined}
        >
          <td className="font-medium text-slate-700">{row.place ?? "–"}</td>
          <td>
            <Link href={`/person/${rowLinkKey(row)}`} className="link-brand">
              {rowDisplayName(row)}
            </Link>
          </td>
          <td className="max-w-[9rem] truncate text-slate-600" title={row.club ?? undefined}>
            {row.club ?? "–"}
          </td>
          <td className="max-w-[7.5rem] truncate text-slate-600">{row.class_name ?? "–"}</td>
          <td className="font-mono text-sm text-slate-700">
            <ResultTimeEditor
              eventId={eventId ?? row.event_id}
              personKey={row.person_key}
              className={row.class_name}
              place={row.place}
              initialTime={row.time ?? ""}
              canEdit={canEdit && eventHasUnreasonableTimes && eventId !== undefined}
            />
          </td>
          <td className="text-slate-500">{row.status ?? "–"}</td>
        </tr>
        );
      })}
    </>
  );
}
