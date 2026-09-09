import Link from "next/link";

import { formatPoints } from "@/lib/mastarnas-points";
import type { MastarnasDiscipline } from "@/lib/mastarnas-types";
import type { StandingRow } from "@/lib/mastarnas-standings";

export function MastarnasStandingsTable({
  rows,
  disciplines,
}: {
  rows: StandingRow[];
  disciplines: MastarnasDiscipline[];
}) {
  const used = disciplines.filter((discipline) => rows.some((row) => row.byDiscipline[discipline.id] != null));

  if (rows.length === 0) {
    return (
      <div className="card px-6 py-12 text-center text-slate-500">
        Inga resultat registrerade i den här vyn ännu.
      </div>
    );
  }

  return (
    <div className="table-shell overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Plac</th>
            <th>Namn</th>
            <th>Klass</th>
            <th>Summa</th>
            {used.map((discipline) => (
              <th key={discipline.id}>{discipline.name}</th>
            ))}
            <th>Starter</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.person_key}>
              <td className="font-medium text-slate-700">{row.place}</td>
              <td>
                <Link href={`/person/${encodeURIComponent(row.person_key)}`} className="link-brand">
                  {row.name}
                </Link>
              </td>
              <td className="text-slate-600">{row.class_name}</td>
              <td className="font-semibold tabular-nums">{formatPoints(row.total)}</td>
              {used.map((discipline) => (
                <td key={discipline.id} className="font-mono text-slate-700 tabular-nums">
                  {row.byDiscipline[discipline.id] != null ? formatPoints(row.byDiscipline[discipline.id] as number) : ""}
                </td>
              ))}
              <td className="text-slate-600 tabular-nums">{row.starts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
