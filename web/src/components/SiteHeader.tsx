"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/resultat", label: "Alla resultat" },
  { href: "/mastarnas", label: "Mästarnas mästare" },
  { href: "/statistik", label: "Statistik" },
  { href: "/sok", label: "Sök" },
  { href: "/ladda-upp", label: "Ladda upp" },
  { href: "/koppla-namn", label: "Koppla namn" },
];

function linkClass(active: boolean) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition ${
    active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-brand-50 hover:text-brand-800"
  }`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="glass-header sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6 md:py-3">
        <Link href="/" className="group flex min-w-0 items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-md shadow-brand-600/25 md:h-9 md:w-9 md:text-sm">
            RB
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-slate-900 group-hover:text-brand-800 md:text-[15px]">
              Resultatbanken
            </span>
            <span className="hidden text-[11px] font-medium text-slate-500 sm:block">IFK Mora OK</span>
          </span>
        </Link>

        <nav className="hidden items-center justify-end gap-1 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(isActive(item.href))}>
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 md:hidden"
          aria-expanded={open}
          aria-controls="mobilmeny"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="sr-only">{open ? "Stäng meny" : "Öppna meny"}</span>
          {open ? (
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/30 md:hidden"
            aria-label="Stäng meny"
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobilmeny"
            className="relative z-50 border-t border-slate-200/80 bg-white px-3 py-1.5 shadow-lg md:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className={`${linkClass(isActive(item.href))} py-2.5`}>
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      ) : null}
    </header>
  );
}
