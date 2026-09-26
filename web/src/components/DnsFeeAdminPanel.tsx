"use client";

import Link from "next/link";
import { FormEvent, Fragment, useCallback, useMemo, useState } from "react";

import type {
  DnsFeeEventRef,
  DnsFeeManualExemption,
  DnsFeeNameVariant,
  DnsFeePersonSummary,
} from "@/lib/dns-fee-types";
import {
  classifyDnsFeeKind,
  describeDnsFeePart,
  getManualWaiverFlags,
  isFeeNameExempt,
  isManualExempt,
  isYouthJuniorEntryFeeExempt,
  rowPayableSplit,
  type DnsFeeManualWaiverFlags,
} from "@/lib/dns-fee-types";
import { buildFeeMailtoLink } from "@/lib/dns-fee-mailto";

function personDetailHref(personId: string, year: number): string {
  const params = new URLSearchParams({ personId, year: String(year) });
  return `/eventor?${params.toString()}`;
}

type Totals = {
  people: number;
  dnsStarts: number;
  starts: number;
  entryFeeGrossSek: number;
  lateFeeGrossSek: number;
  otherFeeGrossSek: number;
  dnsFeeGrossSek: number;
  totalGrossSek: number;
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
  removedEventIds: string[];
  exemptFeeNames: string[];
  manualExemptions: DnsFeeManualExemption[];
  people: DnsFeePersonSummary[];
  events: DnsFeeEventRef[];
  feeNames: DnsFeeNameVariant[];
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
  const [expandedFeeName, setExpandedFeeName] = useState<string | null>(null);

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

  async function setExemptions(
    eventIds: string[],
    action: "add" | "remove",
    mode: "exempt" | "removed" = "exempt",
  ) {
    const ids = eventIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return;
    setError(null);
    try {
      const response = await fetch("/api/anmalan/dns-fees/exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: ids, action, mode }),
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

  async function setFeeNameExemptions(feeNames: string[], action: "add" | "remove") {
    const names = feeNames.map((name) => name.trim()).filter(Boolean);
    if (names.length === 0) return;
    setError(null);
    try {
      const response = await fetch("/api/anmalan/dns-fees/fee-name-exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeNames: names, action }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Kunde inte spara avgiftsundantag.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara avgiftsundantag.");
    }
  }

  async function toggleFeeNameExemption(feeName: string, exempt: boolean) {
    await setFeeNameExemptions([feeName], exempt ? "add" : "remove");
  }

  async function setManualWaiverFlag(
    personId: string,
    eventId: string,
    flag: keyof DnsFeeManualWaiverFlags,
    value: boolean,
  ) {
    setError(null);
    try {
      const response = await fetch("/api/anmalan/dns-fees/manual-exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, eventId, action: "set", [flag]: value }),
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

  const removedEventIds = data.removedEventIds ?? [];
  const exemptEvents = data.events.filter((event) => data.exemptEventIds.includes(event.eventId));
  const removedEvents = data.events.filter((event) => removedEventIds.includes(event.eventId));
  const orphanRemovedEventIds = removedEventIds.filter(
    (eventId) => !data.events.some((event) => event.eventId === eventId),
  );
  const addableEvents = data.events.filter(
    (event) =>
      !data.exemptEventIds.includes(event.eventId) && !removedEventIds.includes(event.eventId),
  );
  const exemptFeeNames = data.exemptFeeNames ?? [];
  const feeNameVariants = data.feeNames ?? [];
  const orphanExemptFeeNames = exemptFeeNames.filter(
    (name) => !feeNameVariants.some((fee) => fee.name === name),
  );
  const trackerForSplit = {
    year: data.year,
    importedAt: data.importedAt,
    rows: [] as DnsFeePersonSummary["rows"],
    members: [],
    exemptEventIds: data.exemptEventIds,
    removedEventIds,
    exemptFeeNames,
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
            År {data.year} · {data.totals.people} deltagare med avgift · {data.totals.starts} starter ·{" "}
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
          <p className="mt-1 text-sm text-slate-500">Deltagare med avgift</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{data.totals.starts}</p>
          <p className="mt-1 text-sm text-slate-500">Starter</p>
        </div>
        {(
          [
            ["Anmälan", data.totals.entryFeeGrossSek, data.totals.entryFeeToPaySek],
            ["Efteranmälan", data.totals.lateFeeGrossSek, data.totals.lateFeeToPaySek],
            ["Övriga tillägg", data.totals.otherFeeGrossSek, data.totals.otherFeeToPaySek],
            ["DNS-kostnad", data.totals.dnsFeeGrossSek, data.totals.dnsFeeToPaySek],
            ["Totalt", data.totals.totalGrossSek, data.totals.totalToPaySek],
          ] as const
        ).map(([label, gross, net]) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {formatSek(net)} kr
            </p>
            <p className="mt-1 text-sm text-slate-500">{label} med undantag</p>
            <p className="mt-2 text-sm tabular-nums text-slate-600">
              {formatSek(gross)} kr{" "}
              <span className="text-slate-400">utan undantag</span>
            </p>
          </div>
        ))}
      </div>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Undantagna tävlingar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Undantag ger 0 kr i ordinarie anmälan (OK/anmäld). Efteranmälan undantas aldrig via
            undantag. Övriga tillägg räknas fortfarande. Du kan i stället ta bort en tävling helt —
            då försvinner alla kostnader (anmälan, efteranmälan, övrigt och DNS) från koll. Båda
            listorna sparas över nya Eventor-importer. Ungdoms- och juniorklasser (t.o.m. 20) i
            Sverige undantas för ordinarie avgift. Stafetter ingår inte. Manuella undantag per
            deltagare styrs med checkboxar för Anmälan / Efteranmälan / Övrigt / DNS.
          </p>
        </div>

        {addableEvents.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Lägg till</p>
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={exemptSelected.length === 0}
                onClick={() => void setExemptions(exemptSelected, "add", "exempt")}
              >
                {exemptSelected.length > 1
                  ? `Undanta ${exemptSelected.length} tävlingar`
                  : "Undanta ordinarie avgift"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={exemptSelected.length === 0}
                onClick={() => void setExemptions(exemptSelected, "add", "removed")}
              >
                {exemptSelected.length > 1
                  ? `Ta bort ${exemptSelected.length} tävlingar helt`
                  : "Ta bort tävling helt"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Alla importerade tävlingar är redan undantagna eller borttagna.
          </p>
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
                      <Link
                        href={`/koll-anmalan/tavling/${encodeURIComponent(event.eventId)}`}
                        className="font-medium link-brand"
                      >
                        {event.eventName}
                      </Link>
                      <span className="ml-2 text-slate-400">{formatDate(event.date)}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        Endast ordinarie anmälan undantas
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-brand-700 hover:underline"
                      onClick={() => void setExemptions([event.eventId], "remove", "exempt")}
                    >
                      Återställ
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-100">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="font-medium text-slate-800">
              Borttagna tävlingar
              <span className="ml-2 font-normal text-slate-400">
                ({removedEvents.length + orphanRemovedEventIds.length})
              </span>
            </span>
          </div>
          {removedEvents.length === 0 && orphanRemovedEventIds.length === 0 ? (
            <p className="border-t border-slate-100 px-3 py-3 text-sm text-slate-500">
              Inga borttagna tävlingar ännu.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {removedEvents.map((event) => (
                <li
                  key={event.eventId}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span>
                    <Link
                      href={`/koll-anmalan/tavling/${encodeURIComponent(event.eventId)}`}
                      className="font-medium link-brand"
                    >
                      {event.eventName}
                    </Link>
                    <span className="ml-2 text-slate-400">{formatDate(event.date)}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Alla kostnader undantas
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-brand-700 hover:underline"
                    onClick={() => void setExemptions([event.eventId], "remove", "removed")}
                  >
                    Återställ
                  </button>
                </li>
              ))}
              {orphanRemovedEventIds.map((eventId) => (
                <li
                  key={eventId}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-slate-800">Tävling #{eventId}</span>
                    <span className="mt-0.5 block text-xs text-amber-700">
                      Saknas i senaste import — återställ för att ta bort från listan
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-brand-700 hover:underline"
                    onClick={() => void setExemptions([eventId], "remove", "removed")}
                  >
                    Återställ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Undantagna avgiftsnamn</h2>
          <p className="mt-1 text-sm text-slate-500">
            Kryssa i de avgifter som alltid ska undantas (t.ex. ungdomsavgifter). Ändringen sparas
            direkt. Klicka på ett avgiftsnamn för att se vilka deltagare som har den avgiften.
            Efteranmälan kan inte undantas. Listan sparas över nya importer.
          </p>
        </div>

        {feeNameVariants.length === 0 && orphanExemptFeeNames.length === 0 ? (
          <p className="text-sm text-slate-500">
            Inga avgiftsnamn ännu — kör en import från Eventor först.
          </p>
        ) : (
          <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {feeNameVariants.map((fee) => {
              const isLate = fee.kind === "late";
              const checked = exemptFeeNames.includes(fee.name);
              const open = expandedFeeName === fee.name;
              return (
                <li key={fee.name}>
                  <div
                    className={`flex items-start gap-3 px-3 py-2.5 text-sm ${
                      isLate ? "bg-slate-50/80" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={isLate}
                      aria-label={`Undanta ${fee.name}`}
                      onChange={(event) =>
                        void toggleFeeNameExemption(fee.name, event.target.checked)
                      }
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setExpandedFeeName(open ? null : fee.name)}
                      aria-expanded={open}
                    >
                      <span className="font-medium text-slate-800 hover:text-brand-800">
                        {fee.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {describeDnsFeePart({
                          entryFeeId: fee.name,
                          name: fee.name,
                          amountSek: fee.totalSek,
                          taxable: null,
                          entryFeeType: null,
                          validToDate: null,
                        })}
                        {" · "}
                        {fee.count} st · {formatSek(fee.totalSek)} kr
                        {isLate ? " · kan inte undantas" : null}
                        <span className="ml-2 text-brand-700">
                          {open ? "dölj deltagare" : "visa deltagare"}
                        </span>
                      </span>
                    </button>
                  </div>
                  {open ? (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                      {(fee.participants ?? []).length === 0 ? (
                        <p className="text-xs text-slate-500">Inga deltagare hittades.</p>
                      ) : (
                        <ul className="max-h-56 space-y-1.5 overflow-y-auto text-xs sm:text-sm">
                          {(fee.participants ?? []).map((participant, index) => (
                            <li
                              key={`${participant.personId}-${participant.eventId}-${participant.date}-${index}`}
                              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-slate-700"
                            >
                              <Link
                                href={personDetailHref(participant.personId, data.year)}
                                className="link-brand font-medium"
                              >
                                {participant.personName}
                              </Link>
                              <span className="text-slate-400">
                                {formatDate(participant.date)} · {participant.eventName}
                                {participant.className !== "–"
                                  ? ` · ${participant.className}`
                                  : ""}
                                {" · "}
                                {statusLabel(participant.status)}
                                {" · "}
                                {formatSek(participant.amountSek)} kr
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
            {orphanExemptFeeNames.map((name) => (
              <li key={name}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked
                    onChange={() => void toggleFeeNameExemption(name, false)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-slate-800">{name}</span>
                    <span className="mt-0.5 block text-xs text-amber-700">
                      Saknas i senaste import — avmarkera för att ta bort
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
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
                            <Link
                              href={personDetailHref(person.personId, data.year)}
                              className="link-brand font-medium"
                            >
                              {person.personName}
                            </Link>
                            {person.email ? (
                              <a
                                href={
                                  buildFeeMailtoLink(
                                    person,
                                    data.exemptEventIds,
                                    data.year,
                                    data.manualExemptions ?? [],
                                    data.exemptFeeNames ?? [],
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
                              {open ? "dölj" : "avgifter"}
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
                        <tr className="border-b border-slate-100 bg-slate-50/70">
                          <td colSpan={7} className="px-3 py-3 sm:px-4">
                            <ul className="space-y-2">
                              {person.rows.map((row) => {
                                const eventExempt = data.exemptEventIds.includes(row.eventId);
                                const youthJunior = isYouthJuniorEntryFeeExempt(row);
                                const waiverFlags = getManualWaiverFlags(
                                  trackerForSplit,
                                  row.personId,
                                  row.eventId,
                                );
                                const manualExempt = isManualExempt(
                                  trackerForSplit,
                                  row.personId,
                                  row.eventId,
                                );
                                const split = rowPayableSplit(trackerForSplit, row);
                                const extraFees = (row.fees ?? []).filter((fee) => {
                                  const kind = classifyDnsFeeKind(fee);
                                  return kind === "late" || kind === "other";
                                });
                                const nameExemptFees = (row.fees ?? []).filter(
                                  (fee) =>
                                    classifyDnsFeeKind(fee) !== "late" &&
                                    isFeeNameExempt(exemptFeeNames, fee.name),
                                );
                                const payableParts = [
                                  {
                                    label: "Anmälan",
                                    amount: split.entryFeeToPaySek,
                                    flag: "waiveAnmalan" as const,
                                    waived: waiverFlags.waiveAnmalan,
                                  },
                                  {
                                    label: "Efteranm.",
                                    amount: split.lateFeeToPaySek,
                                    flag: "waiveLate" as const,
                                    waived: waiverFlags.waiveLate,
                                  },
                                  {
                                    label: "Övrigt",
                                    amount: split.otherFeeToPaySek,
                                    flag: "waiveOther" as const,
                                    waived: waiverFlags.waiveOther,
                                  },
                                  {
                                    label: "DNS",
                                    amount: split.dnsFeeToPaySek,
                                    flag: "waiveDns" as const,
                                    waived: waiverFlags.waiveDns,
                                  },
                                ];

                                return (
                                  <li
                                    key={`${row.eventId}-${row.className}-${row.entryId}-${row.status}`}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4"
                                  >
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                      <div className="min-w-0">
                                        <p className="font-medium text-slate-900">
                                          <span className="tabular-nums text-slate-500">
                                            {formatDate(row.date)}
                                          </span>
                                          <span className="mx-2 text-slate-300">·</span>
                                          <Link
                                            href={`/koll-anmalan/tavling/${encodeURIComponent(row.eventId)}`}
                                            className="link-brand"
                                          >
                                            {row.eventName}
                                          </Link>
                                          {manualExempt ? (
                                            <span className="ml-2 text-sm font-medium text-violet-700">
                                              manuellt undantag
                                            </span>
                                          ) : eventExempt ? (
                                            <span className="ml-2 text-sm font-medium text-amber-700">
                                              undantagen
                                            </span>
                                          ) : null}
                                        </p>
                                        <p className="mt-0.5 text-sm text-slate-500">
                                          {row.className}
                                          {youthJunior ? " · ungdom/junior" : ""}
                                          {" · "}
                                          {statusLabel(row.status)}
                                          {row.status === "dns" && row.dnsReason
                                            ? ` · Orsak: ${row.dnsReason}`
                                            : ""}
                                        </p>
                                      </div>
                                      <p className="shrink-0 text-sm tabular-nums font-semibold text-slate-800">
                                        {row.feeSek === null ? "–" : `${formatSek(row.feeSek)} kr`}
                                        <span className="ml-1 font-normal text-slate-400">totalt</span>
                                      </p>
                                    </div>

                                    {extraFees.length > 0 || nameExemptFees.length > 0 ? (
                                      <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                                        {extraFees.map((fee) => (
                                          <li key={fee.entryFeeId}>
                                            {fee.name} · {formatSek(fee.amountSek)} kr
                                          </li>
                                        ))}
                                        {nameExemptFees.map((fee) => (
                                          <li key={`exempt-${fee.entryFeeId}`} className="text-violet-700">
                                            {fee.name} · {formatSek(fee.amountSek)} kr (undantaget
                                            avgiftsnamn)
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}

                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                      {payableParts.map((part) => (
                                        <div
                                          key={part.flag}
                                          className="rounded-lg bg-slate-50 px-2.5 py-2"
                                        >
                                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                            {part.label}
                                          </p>
                                          <p
                                            className={`mt-0.5 text-sm tabular-nums font-semibold ${
                                              part.waived ? "text-violet-700" : "text-slate-800"
                                            }`}
                                          >
                                            {formatSek(part.amount)} kr
                                          </p>
                                          <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                                            <input
                                              type="checkbox"
                                              checked={part.waived}
                                              onChange={(event) =>
                                                void setManualWaiverFlag(
                                                  row.personId,
                                                  row.eventId,
                                                  part.flag,
                                                  event.target.checked,
                                                )
                                              }
                                            />
                                            <span>Undanta</span>
                                          </label>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="mt-3 border-t border-slate-100 pt-3">
                                      {!eventExempt ? (
                                        <button
                                          type="button"
                                          className="text-xs font-medium text-amber-800 hover:underline"
                                          onClick={() =>
                                            void setExemptions([row.eventId], "add", "exempt")
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
                                  </li>
                                );
                              })}
                            </ul>
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
