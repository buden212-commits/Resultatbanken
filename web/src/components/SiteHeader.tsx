import Link from "next/link";

const nav = [
  { href: "/resultat", label: "Alla resultat" },
  { href: "/statistik", label: "Statistik" },
  { href: "/sok", label: "Sök person" },
  { href: "/ladda-upp", label: "Ladda upp" },
  { href: "/koppla-namn", label: "Koppla namn" },
];

export function SiteHeader() {
  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md shadow-brand-600/25">
            RB
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight text-slate-900 group-hover:text-brand-800">
              Resultatbanken
            </span>
            <span className="text-[11px] font-medium text-slate-500">IFK Mora OK</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
