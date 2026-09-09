import Link from "next/link";

import { COUNTED_RESULTS, formatPoints } from "@/lib/mastarnas-points";
import type { MastarnasDiscipline } from "@/lib/mastarnas-types";
import type { StandingRow } from "@/lib/mastarnas-standings";

function countedDisciplineIds(byDiscipline: Record<string, number | null>): Set<string> {
  return new Set(
    Object.entries(byDiscipline)
      .filter((entry): entry is [string, number] => entry[1] != null && entry[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, COUNTED_RESULTS)
      .map(([id]) => id),
  );
}

export function MastarnasStandingsTable({
  year,
  rows,
  disciplines,
}: {
  year: number;
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
            <th>6 bästa</th>
            <th>Totalt</th>
            {used.map((discipline) => (
              <th key={discipline.id}>
                <Link href={`/mastarnas/${year}?gren=${encodeURIComponent(discipline.id)}`} className="hover:text-brand-800">
                  {discipline.name}
                </Link>
              </th>
            ))}
            <th>Starter</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const counted = countedDisciplineIds(row.byDiscipline);
            return (
              <tr key={row.person_key}>
                <td className="font-medium text-slate-700">{row.place}</td>
                <td>
                  <Link href={`/person/${encodeURIComponent(row.person_key)}`} className="link-brand">
                    {row.name}
                  </Link>
                </td>
                <td className="text-slate-600">{row.class_name}</td>
                <td className="font-semibold tabular-nums">{formatPoints(row.total)}</td>
                <td className="text-slate-600 tabular-nums">{formatPoints(row.totalAll)}</td>
                {used.map((discipline) => {
                  const value = row.byDiscipline[discipline.id];
                  if (value == null) {
                    return <td key={discipline.id} />;
                  }
                  const discarded = row.starts > COUNTED_RESULTS && !counted.has(discipline.id);
                  return (
                    <td key={discipline.id} className="font-mono tabular-nums">
                      <Link
                        href={`/mastarnas/${year}?gren=${encodeURIComponent(discipline.id)}`}
                        className={discarded ? "text-slate-400 hover:text-brand-800" : "text-slate-700 hover:text-brand-800"}
                        title={discarded ? "Räknas inte bland de sex bästa" : undefined}
                      >
                        {formatPoints(value)}
                      </Link>
                    </td>
                  );
                })}
                <td className="text-slate-600 tabular-nums">{row.starts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
