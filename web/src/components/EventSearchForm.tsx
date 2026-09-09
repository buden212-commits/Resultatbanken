"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = {
  initialQuery?: string;
};

export function EventSearchForm({ initialQuery = "" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = query.trim();
    router.push(next ? `/resultat?q=${encodeURIComponent(next)}` : "/resultat");
  }

  return (
    <form onSubmit={onSubmit} className="relative flex flex-col gap-3 sm:flex-row" role="search">
      <div className="relative flex-1">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
          />
        </svg>
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök namn, typ, plats eller år, t.ex. medel 2013"
          className="input-field input-field-with-icon"
          aria-label="Sök resultat"
        />
      </div>
      <button type="submit" className="btn-primary">
        Sök
      </button>
    </form>
  );
}
