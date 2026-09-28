"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type {
  DnsFeeEventWaiver,
  DnsFeeManualWaiverFlags,
  DnsFeePersonSummary,
} from "@/lib/dns-fee-types";
import {
  classifyDnsFeeKind,
  getManualWaiverFlags,
  isFeeNameExempt,
  isManualExempt,
  isYouthJuniorEntryFeeExempt,
  rowPayableSplit,
  type DnsFeeTrackerData,
} from "@/lib/dns-fee-types";
import { buildFeeMailtoLink } from "@/lib/dns-fee-mailto";

function formatSek(value: number): string {
  return value.toLocaleString("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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

function eventorHref(personId: string, year: number): string {
  const params = new URLSearchParams({ personId, year: String(year) });
  return `/eventor?${params.toString()}`;
}

type PersonPayload = {
  year: number;
  exemptEventIds: string[];
  removedEventIds: string[];
  eventWaivers: DnsFeeEventWaiver[];
  exemptFeeNames: string[];
  manualExemptions: DnsFeeTrackerData["manualExemptions"];
  person: DnsFeePersonSummary;
};

export function DnsFeePersonPanel({ initial }: { initial: PersonPayload }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllStarts, setShowAllStarts] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/anmalan/dns-fees/persons/${encodeURIComponent(data.person.personId)}`,
    );
    const json = (await response.json()) as PersonPayload & { error?: string };
    if (!response.ok) {
      throw new Error(json.error || "Kunde inte hämta deltagare.");
    }
    setData(json);
  }, [data.person.personId]);

  async function setExemptions(
    eventIds: string[],
    action: "add" | "remove",
    mode: "exempt" | "removed" = "exempt",
  ) {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/anmalan/dns-fees/exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds, action, mode }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Kunde inte spara undantag.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara undantag.");
    } finally {
      setBusy(false);
    }
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

  const person = data.person;
  const exemptFeeNames = data.exemptFeeNames ?? [];
  const trackerForSplit: DnsFeeTrackerData = {
    year: data.year,
    importedAt: null,
    rows: [],
    members: [],
    exemptEventIds: data.exemptEventIds,
    removedEventIds: data.removedEventIds,
    eventWaivers: data.eventWaivers ?? [],
    exemptFeeNames,
    manualExemptions: data.manualExemptions,
  };

  const visibleRows = showAllStarts
    ? person.rows
    : person.rows.filter((row) => {
        const split = rowPayableSplit(trackerForSplit, row);
        return (
          split.entryFeeToPaySek +
            split.lateFeeToPaySek +
            split.otherFeeToPaySek +
            split.dnsFeeToPaySek >
          0
        );
      });

  const mailto = buildFeeMailtoLink(
    person,
    data.exemptEventIds,
    data.year,
    data.manualExemptions ?? [],
    data.exemptFeeNames ?? [],
  );

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {person.rows.length} starter · {person.dnsCount} DNS ·{" "}
            {formatSek(person.totalToPaySek)} kr att betala
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Anmälan {formatSek(person.entryFeeToPaySek)} · Efteranmälan{" "}
            {formatSek(person.lateFeeToPaySek)} · Övrigt {formatSek(person.otherFeeToPaySek)} · DNS{" "}
            {formatSek(person.dnsFeeToPaySek)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showAllStarts}
              onChange={(event) => setShowAllStarts(event.target.checked)}
            />
            Visa alla tävlingar
          </label>
          {mailto ? (
            <a
              href={mailto}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Skicka mail
            </a>
          ) : null}
          <Link
            href={eventorHref(person.personId, data.year)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Eventor-statistik
          </Link>
        </div>
      </div>

      <ul className="space-y-2">
        {visibleRows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            {person.rows.length === 0
              ? "Inga starter importerade."
              : "Inga tävlingar med belopp att betala. Aktivera ”Visa alla tävlingar” för att se övriga."}
          </li>
        ) : null}
        {visibleRows.map((row) => {
          const eventExempt = data.exemptEventIds.includes(row.eventId);
          const youthJunior = isYouthJuniorEntryFeeExempt(row);
          const waiverFlags = getManualWaiverFlags(trackerForSplit, row.personId, row.eventId);
          const manualExempt = isManualExempt(trackerForSplit, row.personId, row.eventId);
          const split = rowPayableSplit(trackerForSplit, row);
          const extraFees = (row.fees ?? []).filter((fee) => {
            const kind = classifyDnsFeeKind(fee);
            return kind === "late" || kind === "other";
          });
          const nameExemptFees = (row.fees ?? []).filter(
            (fee) =>
              classifyDnsFeeKind(fee) !== "late" && isFeeNameExempt(exemptFeeNames, fee.name),
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
                    <span className="tabular-nums text-slate-500">{formatDate(row.date)}</span>
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
                      <span className="ml-2 text-sm font-medium text-amber-700">undantagen</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {row.className}
                    {youthJunior ? " · ungdom/junior" : ""}
                    {" · "}
                    {statusLabel(row.status)}
                    {row.status === "dns" && row.dnsReason ? ` · Orsak: ${row.dnsReason}` : ""}
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
                      {fee.name} · {formatSek(fee.amountSek)} kr (undantaget avgiftsnamn)
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {payableParts.map((part) => (
                  <div key={part.flag} className="rounded-lg bg-slate-50 px-2.5 py-2">
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
                        disabled={busy}
                        onChange={(changeEvent) =>
                          void setManualWaiverFlag(
                            row.personId,
                            row.eventId,
                            part.flag,
                            changeEvent.target.checked,
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
                    className="text-xs font-medium text-amber-800 hover:underline disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void setExemptions([row.eventId], "add", "exempt")}
                    title="Undantar tävlingen för alla deltagare"
                  >
                    Undanta tävling för alla
                  </button>
                ) : (
                  <span className="text-xs text-amber-700">Tävlingen undantagen</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
