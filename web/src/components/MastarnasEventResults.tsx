import Link from "next/link";

import { formatPoints, resultPoints } from "@/lib/mastarnas-points";
import type { MastarnasClass, MastarnasEvent } from "@/lib/mastarnas-types";

function statusLabel(status: string): string {
  if (status === "dnf") {
    return "DNF";
  }
  if (status === "dns") {
    return "DNS";
  }
  return "";
}

export function MastarnasEventResults({
  year,
  event,
  classes,
  canEdit,
}: {
  year: number;
  event: MastarnasEvent;
  classes: MastarnasClass[];
  canEdit: boolean;
}) {
  const points = resultPoints(event.results);
  const className = new Map(classes.map((item) => [item.id, item.name]));
  const usedClassIds = [...new Set(event.results.map((result) => result.class_id))].sort((a, b) =>
    (className.get(a) ?? a).localeCompare(className.get(b) ?? b, "sv"),
  );

  if (event.results.length === 0) {
    return (
      <div className="card px-6 py-12 text-center text-slate-500">
        Inga resultat registrerade i {event.name} {year} ännu.
        {canEdit ? " Välj klassen nedan och lägg till deltagare." : ""}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {usedClassIds.map((classId) => {
        const rows = event.results
          .filter((result) => result.class_id === classId)
          .sort((a, b) => {
            if (a.place !== null && b.place !== null && a.place !== b.place) {
              return a.place - b.place;
            }
            if (a.place !== null && b.place === null) {
              return -1;
            }
            if (a.place === null && b.place !== null) {
              return 1;
            }
            return a.name.localeCompare(b.name, "sv");
          });

        return (
          <section key={classId} className="table-shell overflow-x-auto">
            <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
              <h3 className="text-base font-semibold text-slate-900">{className.get(classId) ?? classId}</h3>
              {canEdit ? (
                <Link
                  href={`/mastarnas/${year}?gren=${encodeURIComponent(event.discipline_id)}&klass=${encodeURIComponent(classId)}#redigera`}
                  className="text-sm font-medium text-brand-700 hover:text-brand-900"
                >
                  Redigera klassen
                </Link>
              ) : null}
            </div>
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
                {rows.map((result) => (
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
          </section>
        );
      })}
    </div>
  );
}
