"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type Props = {
  eventTypes: string[];
  eventorConfigured: boolean;
};

type SearchHit = {
  eventorId: string;
  name: string;
  date: string;
  organizer: string;
  type: string;
  alreadyImported: boolean;
  localEventId: number | null;
};

type SubmitResult = {
  id: number;
  url: string;
  name?: string;
  resultCountHint?: number;
  deploy: { mode: "local" | "git"; ok: boolean; message: string };
};

type Scope = "club_entries" | "club_organised" | "all";

function defaultFromDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function EventorImportForm({ eventTypes, eventorConfigured }: Props) {
  const [scope, setScope] = useState<Scope>("club_entries");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [freeText, setFreeText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const selected = useMemo(
    () => hits.find((hit) => hit.eventorId === selectedId) ?? null,
    [hits, selectedId],
  );

  if (!eventorConfigured) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-medium">Eventor-import är inte aktiverad.</p>
        <p className="mt-2">
          Sätt <code className="rounded bg-amber-100 px-1">EVENTOR_API_KEY</code> i{" "}
          <code className="rounded bg-amber-100 px-1">web/.env.local</code> (lokalt) eller
          som miljövariabel på Vercel.
        </p>
      </div>
    );
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchError("");
    setError("");
    setIsSearching(true);
    setHasSearched(true);
    setSelectedId(null);

    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        scope,
        q: query.trim(),
      });
      const response = await fetch(`/api/admin/events/eventor-search?${params}`);
      const data = (await response.json()) as { events?: SearchHit[]; error?: string };
      if (!response.ok) {
        setHits([]);
        setSearchError(data.error ?? "Kunde inte söka i Eventor.");
        return;
      }
      setHits(data.events ?? []);
    } catch {
      setHits([]);
      setSearchError("Kunde inte ansluta till servern.");
    } finally {
      setIsSearching(false);
    }
  }

  async function onImport() {
    if (!selected || selected.alreadyImported) return;
    setError("");
    setResult(null);
    setIsImporting(true);

    try {
      const response = await fetch("/api/admin/events/from-eventor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventorId: selected.eventorId,
          type: type.trim() || undefined,
          free_text: freeText.trim() || undefined,
        }),
      });

      const data = (await response.json()) as SubmitResult & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Kunde inte importera från Eventor.");
        return;
      }

      setResult(data);
      setHits((prev) =>
        prev.map((hit) =>
          hit.eventorId === selected.eventorId
            ? { ...hit, alreadyImported: true, localEventId: data.id }
            : hit,
        ),
      );
      setSelectedId(null);
      setType("");
      setFreeText("");
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">
            Importerade {result.name ?? "resultat"} som id {result.id}
            {result.resultCountHint != null ? ` (${result.resultCountHint} starter)` : ""}.
          </p>
          <p className="mt-1">
            <Link href={result.url} className="link-brand">
              Visa resultatsidan →
            </Link>
          </p>
          <p className={`mt-2 ${result.deploy.ok ? "text-emerald-800" : "text-amber-800"}`}>
            {result.deploy.ok
              ? result.deploy.mode === "git"
                ? "Sidan uppdateras inom några minuter."
                : "Personsökningen är uppdaterad."
              : "Resultatet sparades, men indexeringen kan ha misslyckats."}
          </p>
        </div>
      ) : null}

      <div className="card space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Importera från Eventor</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sök tävlingar, välj en i listan och importera IFK Mora OK:s klubbresultat.
          </p>
        </div>

        <form onSubmit={onSearch} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Visa</legend>
            <div className="flex flex-col gap-2 text-sm text-slate-700 sm:flex-row sm:flex-wrap">
              {(
                [
                  ["club_entries", "Med klubbanmälan"],
                  ["club_organised", "Arrangerade av klubben"],
                  ["all", "Alla tävlingar"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="eventor-from" className="mb-1.5 block text-sm font-medium text-slate-700">
                Från
              </label>
              <input
                id="eventor-from"
                type="date"
                className="input-field"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="eventor-to" className="mb-1.5 block text-sm font-medium text-slate-700">
                Till
              </label>
              <input
                id="eventor-to"
                type="date"
                className="input-field"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="eventor-q" className="mb-1.5 block text-sm font-medium text-slate-700">
                Sök namn / arrangör / id
                {scope === "all" ? <span className="text-red-500"> *</span> : null}
              </label>
              <input
                id="eventor-q"
                className="input-field"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={scope === "all" ? "Minst 2 tecken, t.ex. DM Dalarna" : "Valfritt filter"}
                required={scope === "all"}
                minLength={scope === "all" ? 2 : undefined}
              />
            </div>
          </div>

          {searchError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {searchError}
            </p>
          ) : null}

          <button type="submit" className="btn-primary" disabled={isSearching}>
            {isSearching ? "Söker…" : "Sök tävlingar"}
          </button>
        </form>

        {hasSearched && !isSearching ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              {hits.length === 0
                ? "Inga tävlingar matchade."
                : `${hits.length} tävling${hits.length === 1 ? "" : "ar"} — klicka för att välja.`}
            </p>
            {hits.length > 0 ? (
              <ul className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {hits.map((hit) => {
                  const isSelected = selectedId === hit.eventorId;
                  return (
                    <li key={hit.eventorId}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(hit.eventorId)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition ${
                          isSelected ? "bg-brand-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-medium text-slate-900">
                          {hit.date || "?"} — {hit.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {hit.organizer || "Okänd arrangör"} · {hit.type} · id {hit.eventorId}
                          {hit.alreadyImported
                            ? ` · redan importerad (#${hit.localEventId})`
                            : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

        {selected ? (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Vald tävling</p>
              <p className="mt-1 text-sm text-slate-700">
                {selected.date} — {selected.name}
              </p>
              <p className="text-xs text-slate-500">
                Eventor-id {selected.eventorId}
                {selected.alreadyImported
                  ? ` · finns redan som #${selected.localEventId}`
                  : ""}
              </p>
            </div>

            {!selected.alreadyImported ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="eventor-type" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Typ (valfritt)
                  </label>
                  <input
                    id="eventor-type"
                    list="eventor-event-types"
                    className="input-field"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder={selected.type || "Hämtas från Eventor"}
                  />
                  <datalist id="eventor-event-types">
                    {eventTypes.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="eventor-free_text"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Fritext (valfritt)
                  </label>
                  <textarea
                    id="eventor-free_text"
                    rows={2}
                    className="input-field resize-y"
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder="Egen kommentar — Eventor-länk läggs till automatiskt"
                  />
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            {selected.alreadyImported ? (
              <p className="text-sm text-slate-600">
                Redan importerad.{" "}
                <Link href={`/resultat/${selected.localEventId}`} className="link-brand">
                  Visa resultat →
                </Link>
              </p>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={isImporting}
                onClick={() => void onImport()}
              >
                {isImporting ? "Importerar…" : "Importera klubbresultat"}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
