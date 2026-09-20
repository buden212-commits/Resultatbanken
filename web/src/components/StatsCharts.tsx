type CountEntry = {
  label: string;
  count: number;
};

type YearCount = {
  year: string;
  count: number;
};

/** Client-safe chart widgets (no DB / Eventor / MM server imports). */
export function StatsBarChart({
  items,
  valueLabel = "starter",
}: {
  items: YearCount[] | CountEntry[];
  valueLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Ingen data att visa.</p>;
  }

  const max = Math.max(...items.map((item) => item.count));
  const isYearSeries = "year" in items[0];

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const label = isYearSeries ? (item as YearCount).year : (item as CountEntry).label;
        const width = max > 0 ? Math.max(4, Math.round((item.count / max) * 100)) : 0;
        return (
          <div
            key={label}
            className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 text-sm sm:grid-cols-[4.5rem_1fr_auto] sm:gap-3"
          >
            <span className="font-medium text-slate-600">{label}</span>
            <div className="h-3 min-w-0 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="whitespace-nowrap tabular-nums text-slate-500">
              {item.count.toLocaleString("sv-SE")}
              <span className="hidden sm:inline"> {valueLabel}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsCountTable({
  title,
  items,
  labelHeader = "Namn",
}: {
  title: string;
  items: CountEntry[];
  labelHeader?: string;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Ingen data.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-4">{labelHeader}</th>
                <th className="py-2 text-right">Antal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.label} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pr-4 font-medium text-slate-800">{item.label}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">
                    {item.count.toLocaleString("sv-SE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
