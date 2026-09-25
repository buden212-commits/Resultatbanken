"use client";

import { FormEvent, Fragment, useCallback, useMemo, useState } from "react";

import type { DnsFeeEventRef, DnsFeeManualExemption, DnsFeePersonSummary } from "@/lib/dns-fee-types";
import {
  classifyDnsFeeKind,
  isManualExempt,
  isYouthJuniorEntryFeeExempt,
  rowPayableSplit,
} from "@/lib/dns-fee-types";
import { buildFeeMailtoLink } from "@/lib/dns-fee-mailto";

type Totals = {
  people: number;
  dnsStarts: number;
  starts: number;
  entryFeeToPaySek: number;
  lateFeeToPaySek: number;
  otherFeeToPaySek: number;
  dnsFeeToPaySek: number;
  totalToPaySek: number;
};

type Payload = {
  year: number;
  importedAt: string | null;
  exemptEventIds: string[];
  manualExemptions: DnsFeeManualExemption[];
  people: DnsFeePersonSummary[];
  events: DnsFeeEventRef[];
  totals: Totals;
};

type SortKey =
  | "personName"
  | "dnsCount"
  | "startCount"
  | "entryFeeToPaySek"
  | "lateFeeToPaySek"
  | "otherFeeToPaySek"
  | "dnsFeeToPaySek"
  | "totalToPaySek";

function formatSek(value: number): string {
  return value.toLocaleString("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatImportedAt(value: string | null): string {
  if (!value) return "Aldrig";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("sv-SE");
}

function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "–";
  const [y, m, d] = date.split("-");
  return `${Number(d)}/${Number(m)} ${y}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "ok":
      return "OK";
    case "dns":
      return "DNS";
    case "dnf":
      return "DNF";
    case "entered":
      return "Anmäld";
    default:
      return status;
  }
}

export function AnmalanLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/anmalan/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Inloggning misslyckades.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-md space-y-4 p-6">
      <div>
        <label htmlFor="anmalan-password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Lösenord
        </label>
        <input
          id="anmalan-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input-field"
          required
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}

export function DnsFeeAdminPanel({ initial }: { initial: Payload }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [onlyPayable, setOnlyPayable] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("totalToPaySek");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exemptSelected, setExemptSelected] = useState<string[]>([]);
  const [exemptListOpen, setExemptListOpen] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/anmalan/dns-fees");
    const json = (await response.json()) as Payload & { error?: string };
    if (!response.ok) {
      throw new Error(json.error || "Kunde inte ladda data.");
    }
    setData(json);
  }, []);

  async function runImport() {
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/anmalan/dns-fees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: data.year || 2026 }),
      });
      const json = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(json.error || "Import misslyckades.");
      }
      setMessage(json.message ?? "Import klar.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import misslyckades.");
    } finally {
      setImporting(false);
    }
  }

  async function setExemptions(eventIds: string[], action: "add" | "remove") {
    const ids = eventIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return;
    setError(null);
    try {
      const response = await fetch("/api/anmalan/dns-fees/exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: ids, action }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Kunde inte spara undantag.");
      }
      await refresh();
      if (action === "add") setExemptSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara undantag.");
    }
  }

  async function setManualExemption(
    personId: string,
    eventId: string,
    action: "add" | "remove",
  ) {
    setError(null);
    try {
      const response = await fetch("/api/anmalan/dns-fees/manual-exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, eventId, action }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Kunde inte spara manuellt undantag.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara manuellt undantag.");
    }
  }

  function toggleExemptSelected(eventId: string) {
    setExemptSelected((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    );
  }

  const people = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("sv");
    let list = data.people;
    if (q) {
      list = list.filter((person) => person.personName.toLocaleLowerCase("sv").includes(q));
    }
    if (onlyPayable) {
      list = list.filter((person) => person.totalToPaySek > 0);
    }
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        const cmp = av.localeCompare(bv, "sv");
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data.people, query, onlyPayable, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "personName" ? "asc" : "desc");
    }
  }

  const exemptEvents = data.events.filter((event) => data.exemptEventIds.includes(event.eventId));
  const addableEvents = data.events.filter((event) => !data.exemptEventIds.includes(event.eventId));
  const trackerForSplit = {
    year: data.year,
    importedAt: data.importedAt,
    rows: [] as DnsFeePersonSummary["rows"],
    members: [],
    exemptEventIds: data.exemptEventIds,
    manualExemptions: data.manualExemptions ?? [],
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Senast importerat:{" "}
            <span className="font-medium text-slate-700">{formatImportedAt(data.importedAt)}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            År {data.year} · {data.totals.people} medlemmar · {data.totals.starts} starter ·{" "}
            {data.totals.dnsStarts} DNS
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={importing} onClick={() => void runImport()}>
            {importing
              ? "Importerar från Eventor…"
              : data.importedAt
                ? "Uppdatera från Eventor"
                : "Importera från Eventor"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() =>
              void fetch("/api/anmalan/logout", { method: "POST" }).then(() => window.location.reload())
            }
          >
            Logga ut
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {importing ? (
        <p className="text-sm text-slate-500">
          Hämtar anmälningar och resultat per tävling för {data.year}. Det kan ta några minuter.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{data.totals.people}</p>
          <p className="mt-1 text-sm text-slate-500">Klubbmedlemmar</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{data.totals.starts}</p>
          <p className="mt-1 text-sm text-slate-500">Starter</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {formatSek(data.totals.entryFeeToPaySek)} kr
          </p>
          <p className="mt-1 text-sm text-slate-500">Anmälan</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {formatSek(data.totals.lateFeeToPaySek)} kr
          </p>
          <p className="mt-1 text-sm text-slate-500">Efteranmälan</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {formatSek(data.totals.otherFeeToPaySek)} kr
          </p>
          <p className="mt-1 text-sm text-slate-500">Övriga tillägg</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {formatSek(data.totals.dnsFeeToPaySek)} kr
          </p>
          <p className="mt-1 text-sm text-slate-500">DNS-kostnad</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {formatSek(data.totals.totalToPaySek)} kr
          </p>
          <p className="mt-1 text-sm text-slate-500">Totalt att betala</p>
        </div>
      </div>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Undantagna tävlingar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Undantagna tävlingar ger 0 kr i ordinarie anmälan (OK/anmäld). Efteranmälan undantas
            aldrig. Övriga tillägg räknas fortfarande vid tävlingsundantag. Ungdoms- och
            juniorklasser (t.o.m. 20) i Sverige undantas på samma sätt för ordinarie avgift.
            DNS-kostnad räknas alltid. Stafetter ingår inte. Manuella undantag per deltagare (via
            detaljvyn) tar bort övriga kostnader men aldrig efteranmälan, och sparas över
            Eventor-importer.
          </p>
        </div>

        {addableEvents.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Lägg till undantag</p>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {addableEvents.map((event) => {
                const checked = exemptSelected.includes(event.eventId);
                return (
                  <li key={event.eventId}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => toggleExemptSelected(event.eventId)}
                      />
                      <span>
                        <span className="font-medium text-slate-800">{event.eventName}</span>
                        <span className="ml-2 text-slate-400">{formatDate(event.date)}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="btn-primary"
              disabled={exemptSelected.length === 0}
              onClick={() => void setExemptions(exemptSelected, "add")}
            >
              {exemptSelected.length > 1
                ? `Lägg till ${exemptSelected.length} undantag`
                : "Lägg till undantag"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Alla importerade tävlingar är redan undantagna.</p>
        )}

        <div className="rounded-xl border border-slate-100">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm"
            onClick={() => setExemptListOpen((open) => !open)}
            aria-expanded={exemptListOpen}
          >
            <span className="font-medium text-slate-800">
              Sparade undantag
              <span className="ml-2 font-normal text-slate-400">({exemptEvents.length})</span>
            </span>
            <span className="text-slate-400">{exemptListOpen ? "Dölj" : "Visa"}</span>
          </button>
          {exemptListOpen ? (
            exemptEvents.length === 0 ? (
              <p className="border-t border-slate-100 px-3 py-3 text-sm text-slate-500">
                Inga undantag ännu.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {exemptEvents.map((event) => (
                  <li
                    key={event.eventId}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium text-slate-800">{event.eventName}</span>
                      <span className="ml-2 text-slate-400">{formatDate(event.date)}</span>
                    </span>
                    <button
                      type="button"
                      className="text-brand-700 hover:underline"
                      onClick={() => void setExemptions([event.eventId], "remove")}
                    >
                      Ta bort
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="dns-filter" className="mb-1 block text-sm font-medium text-slate-700">
              Filtrera namn
            </label>
            <input
              id="dns-filter"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input-field"
              placeholder="Sök deltagare…"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyPayable}
              onChange={(event) => setOnlyPayable(event.target.checked)}
            />
            Bara med belopp att betala
          </label>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-3 sm:px-4">
                    <button type="button" className="hover:text-slate-700" onClick={() => toggleSort("personName")}>
                      Deltagare
                    </button>
                  </th>
                  <th className="px-3 py-3 sm:px-4">
                    <button type="button" className="hover:text-slate-700" onClick={() => toggleSort("dnsCount")}>
                      DNS
                    </button>
                  </th>
                  <th className="px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      className="hover:text-slate-700"
                      onClick={() => toggleSort("entryFeeToPaySek")}
                    >
                      Anmälan
                    </button>
                  </th>
                  <th className="px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      className="hover:text-slate-700"
                      onClick={() => toggleSort("lateFeeToPaySek")}
                    >
                      Efteranmälan
                    </button>
                  </th>
                  <th className="px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      className="hover:text-slate-700"
                      onClick={() => toggleSort("otherFeeToPaySek")}
                    >
                      Övrigt
                    </button>
                  </th>
                  <th className="px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      className="hover:text-slate-700"
                      onClick={() => toggleSort("dnsFeeToPaySek")}
                    >
                      DNS-kostnad
                    </button>
                  </th>
                  <th className="px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      className="hover:text-slate-700"
                      onClick={() => toggleSort("totalToPaySek")}
                    >
                      Totalt
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {
                  const open = expanded === person.personId;
                  return (
                    <Fragment key={person.personId}>
                      <tr className="border-b border-slate-50">
                        <td className="px-3 py-2.5 sm:px-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-left font-medium text-slate-800 hover:text-brand-800"
                              onClick={() => setExpanded(open ? null : person.personId)}
                            >
                              {person.personName}
                            </button>
                            {person.email ? (
                              <a
                                href={
                                  buildFeeMailtoLink(
                                    person,
                                    data.exemptEventIds,
                                    data.year,
                                    data.manualExemptions ?? [],
                                  ) ?? undefined
                                }
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50"
                                title={`Skicka mail: Startavgifter och Ej start (${person.email})`}
                                aria-label={`Skicka mail till ${person.personName}`}
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden
                                >
                                  <path d="M2.003 5.884 10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884Z" />
                                  <path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118Z" />
                                </svg>
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className="text-xs font-normal text-slate-400 hover:text-brand-700"
                              onClick={() => setExpanded(open ? null : person.personId)}
                            >
                              {open ? "dölj" : "detaljer"}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">{person.dnsCount}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">
                          {formatSek(person.entryFeeToPaySek)} kr
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">
                          {formatSek(person.lateFeeToPaySek)} kr
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">
                          {formatSek(person.otherFeeToPaySek)} kr
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700 sm:px-4">
                          {formatSek(person.dnsFeeToPaySek)} kr
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-medium text-slate-900 sm:px-4">
                          {formatSek(person.totalToPaySek)} kr
                        </td>
                      </tr>
                      {open ? (
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <td colSpan={7} className="px-3 py-3 sm:px-4">
                            <table className="min-w-full text-xs sm:text-sm">
                              <thead>
                                <tr className="text-left text-slate-400">
                                  <th className="py-1 pr-3">Datum</th>
                                  <th className="py-1 pr-3">Tävling</th>
                                  <th className="py-1 pr-3">Klass</th>
                                  <th className="py-1 pr-3">Status</th>
                                  <th className="py-1 pr-3">Avgift</th>
                                  <th className="py-1 pr-3">Anmälan</th>
                                  <th className="py-1 pr-3">Efteranm.</th>
                                  <th className="py-1 pr-3">Övrigt</th>
                                  <th className="py-1 pr-3">DNS</th>
                                  <th className="py-1">Åtgärd</th>
                                </tr>
                              </thead>
                              <tbody>
                                {person.rows.map((row) => {
                                  const eventExempt = data.exemptEventIds.includes(row.eventId);
                                  const youthJunior = isYouthJuniorEntryFeeExempt(row);
                                  const manualExempt = isManualExempt(
                                    trackerForSplit,
                                    row.personId,
                                    row.eventId,
                                  );
                                  const split = rowPayableSplit(trackerForSplit, row);
                                  const rowTotal =
                                    split.entryFeeToPaySek +
                                    split.lateFeeToPaySek +
                                    split.otherFeeToPaySek +
                                    split.dnsFeeToPaySek;
                                  return (
                                    <tr key={`${row.eventId}-${row.className}-${row.entryId}-${row.status}`}>
                                      <td className="py-1 pr-3 tabular-nums text-slate-600">
                                        {formatDate(row.date)}
                                      </td>
                                      <td className="py-1 pr-3 text-slate-700">
                                        {row.eventName}
                                        {manualExempt ? (
                                          <span className="ml-2 font-medium text-violet-700">
                                            (manuellt undantag)
                                          </span>
                                        ) : eventExempt ? (
                                          <span className="ml-2 text-amber-700">(undantagen)</span>
                                        ) : null}
                                      </td>
                                      <td className="py-1 pr-3 text-slate-600">
                                        {row.className}
                                        {youthJunior ? (
                                          <span className="ml-2 text-amber-700">(ungdom/junior)</span>
                                        ) : null}
                                      </td>
                                      <td className="py-1 pr-3 text-slate-600">
                                        {statusLabel(row.status)}
                                        {row.status === "dns" && row.dnsReason ? (
                                          <span className="mt-0.5 block max-w-xs text-xs font-normal normal-case tracking-normal text-slate-500">
                                            Orsak: {row.dnsReason}
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="py-1 pr-3 tabular-nums text-slate-600">
                                        {row.feeSek === null ? "–" : `${formatSek(row.feeSek)} kr`}
                                        {row.fees && row.fees.length > 0
                                          ? (() => {
                                              const extraFees = row.fees.filter(
                                                (fee) => classifyDnsFeeKind(fee) !== "ordinary",
                                              );
                                              if (extraFees.length === 0) return null;
                                              return (
                                                <ul className="mt-1 space-y-0.5 text-left text-xs font-normal normal-case tracking-normal text-slate-500">
                                                  {extraFees.map((fee) => (
                                                    <li key={fee.entryFeeId}>
                                                      {fee.name} · {formatSek(fee.amountSek)} kr
                                                    </li>
                                                  ))}
                                                </ul>
                                              );
                                            })()
                                          : null}
                                      </td>
                                      <td
                                        className={`py-1 pr-3 tabular-nums ${
                                          manualExempt ? "text-violet-700" : "text-slate-800"
                                        }`}
                                      >
                                        {formatSek(split.entryFeeToPaySek)} kr
                                      </td>
                                      <td
                                        className={`py-1 pr-3 tabular-nums ${
                                          manualExempt ? "text-violet-700" : "text-slate-800"
                                        }`}
                                      >
                                        {formatSek(split.lateFeeToPaySek)} kr
                                      </td>
                                      <td
                                        className={`py-1 pr-3 tabular-nums ${
                                          manualExempt ? "text-violet-700" : "text-slate-800"
                                        }`}
                                      >
                                        {formatSek(split.otherFeeToPaySek)} kr
                                      </td>
                                      <td
                                        className={`py-1 pr-3 tabular-nums ${
                                          manualExempt ? "text-violet-700" : "text-slate-800"
                                        }`}
                                      >
                                        {formatSek(split.dnsFeeToPaySek)} kr
                                      </td>
                                      <td className="py-1 align-top">
                                        <div className="flex flex-col items-start gap-1">
                                          {manualExempt ? (
                                            <button
                                              type="button"
                                              className="text-left text-xs font-medium text-violet-700 hover:underline"
                                              onClick={() =>
                                                void setManualExemption(
                                                  row.personId,
                                                  row.eventId,
                                                  "remove",
                                                )
                                              }
                                            >
                                              Återställ kostnad
                                            </button>
                                          ) : rowTotal > 0 ? (
                                            <button
                                              type="button"
                                              className="text-left text-xs font-medium text-brand-700 hover:underline"
                                              onClick={() =>
                                                void setManualExemption(
                                                  row.personId,
                                                  row.eventId,
                                                  "add",
                                                )
                                              }
                                            >
                                              Ta bort kostnad
                                            </button>
                                          ) : null}
                                          {!eventExempt ? (
                                            <button
                                              type="button"
                                              className="text-left text-xs font-medium text-amber-800 hover:underline"
                                              onClick={() =>
                                                void setExemptions([row.eventId], "add")
                                              }
                                              title="Undantar tävlingen för alla deltagare (samma som undantagna tävlingar)"
                                            >
                                              Undanta tävling för alla
                                            </button>
                                          ) : (
                                            <span className="text-xs text-amber-700">
                                              Tävlingen undantagen
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {people.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {data.importedAt ? "Inga träffar för filtret." : "Ingen data ännu — kör en import från Eventor."}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
