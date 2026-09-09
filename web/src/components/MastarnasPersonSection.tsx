import Link from "next/link";

import { formatPoints } from "@/lib/mastarnas-points";
import { personSeasonRows } from "@/lib/mastarnas-standings";
import { readMastarnasData } from "@/lib/mastarnas";
import { resolvePersonKey } from "@/lib/person-aliases";

export function MastarnasPersonSection({ personKey }: { personKey: string }) {
  const data = readMastarnasData();
  const rows = personSeasonRows(data, resolvePersonKey(personKey));
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-bold text-slate-900">Mästarnas Mästare</h2>
      <div className="table-shell overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>År</th>
              <th>Klass</th>
              <th>Plac totalt</th>
              <th>6 bästa</th>
              <th>Totalt</th>
              <th>Starter</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ year, row }) => (
              <tr key={year}>
                <td>
                  <Link href={`/mastarnas/${year}`} className="link-brand">
                    {year}
                  </Link>
                </td>
                <td className="text-slate-600">{row.class_name}</td>
                <td className="font-medium">{row.place}</td>
                <td className="tabular-nums">{formatPoints(row.total)}</td>
                <td className="text-slate-600 tabular-nums">{formatPoints(row.totalAll)}</td>
                <td className="text-slate-600">{row.starts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
