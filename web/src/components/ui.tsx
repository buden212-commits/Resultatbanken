export function TypeBadge({ label }: { label: string }) {
  if (!label) {
    return null;
  }

  return <span className="badge">{label}</span>;
}

export function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="card px-5 py-4">
      {subtitle ? <p className="text-sm font-medium text-slate-500">{subtitle}</p> : null}
      <p className={`font-bold tracking-tight text-slate-900 ${subtitle ? "mt-1 text-xl" : "text-2xl"}`}>
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}
