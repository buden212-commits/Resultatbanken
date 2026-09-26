"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type { DnsFeeEventDetail, DnsFeeManualWaiverFlags } from "@/lib/dns-fee-types";
import {
  classifyDnsFeeKind,
  getManualWaiverFlags,
  isFeeNameExempt,
  isYouthJuniorEntryFeeExempt,
  type DnsFeeTrackerData,
} from "@/lib/dns-fee-types";

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

function personDetailHref(personId: string, year: number): string {
  const params = new URLSearchParams({ personId, year: String(year) });
  return `/eventor?${params.toString()}`;
}

type EventPayload = {
  year: number;
  exemptEventIds: string[];
  removedEventIds: string[];
  exemptFeeNames: string[];
  manualExemptions: DnsFeeTrackerData["manualExemptions"];
  event: DnsFeeEventDetail;
};

export function DnsFeeEventPanel({ initial }: { initial: EventPayload }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/anmalan/dns-fees/events/${encodeURIComponent(data.event.eventId)}`);
    const json = (await response.json()) as EventPayload & { error?: string };
    if (!response.ok) {
      throw new Error(json.error || "Kunde inte hämta tävling.");
    }
    setData(json);
  }, [data.event.eventId]);

  async function setEventMode(action: "add" | "remove", mode: "exempt" | "removed") {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/anmalan/dns-fees/exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [data.event.eventId], action, mode }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Kunde inte spara.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara.");
    } finally {
      setBusy(false);
    }
  }

  async function setManualWaiverFlag(
    personId: string,
    flag: keyof DnsFeeManualWaiverFlags,
    value: boolean,
  ) {
    setError(null);
    try {
      const response = await fetch("/api/anmalan/dns-fees/manual-exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          eventId: data.event.eventId,
          action: "set",
          [flag]: value,
        }),
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

  const trackerForSplit: DnsFeeTrackerData = {
    year: data.year,
    importedAt: null,
    rows: [],
    members: [],
    exemptEventIds: data.exemptEventIds,
    removedEventIds: data.removedEventIds,
    exemptFeeNames: data.exemptFeeNames,
    manualExemptions: data.manualExemptions,
  };

  const event = data.event;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {event.removed ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Borttagen tävling</p>
          <p className="mt-1">
            Tävlingen ingår inte i koll på anmälan. Alla kostnader undantas tills du återställer
            den.
          </p>
        </div>
      ) : event.exempt ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
          Ordinarie anmälan är undantagen för alla deltagare. Efteranmälan och övrigt kan fortfarande
          räknas.
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {formatDate(event.date)} · {event.totals.people} deltagare ·{" "}
            {formatSek(event.totals.totalToPaySek)} kr att betala
            {event.removed ? " (om återställd)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {event.removed ? (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void setEventMode("remove", "removed")}
            >
              Återställ tävling
            </button>
          ) : (
            <button
              type="button"
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              disabled={busy}
              onClick={() => void setEventMode("add", "removed")}
            >
              Sätt som borttagen tävling
            </button>
          )}
          {!event.removed && !event.exempt ? (
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => void setEventMode("add", "exempt")}
            >
              Undanta ordinarie avgift
            </button>
          ) : null}
          {!event.removed && event.exempt ? (
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => void setEventMode("remove", "exempt")}
            >
              Återställ undantag
            </button>
          ) : null}
        </div>
      </div>

      <ul className="space-y-2">
        {event.participants.map((participant) => {
          const waiverFlags = getManualWaiverFlags(
            trackerForSplit,
            participant.personId,
            event.eventId,
          );
          const youthJunior = isYouthJuniorEntryFeeExempt({
            personId: participant.personId,
            personName: participant.personName,
            eventId: event.eventId,
            eventName: event.eventName,
            date: event.date,
            className: participant.className,
            status: participant.status,
            feeSek: participant.feeSek,
            fees: participant.fees,
            entryId: participant.entryId,
            inSweden: true,
          });
          const extraFees = (participant.fees ?? []).filter((fee) => {
            const kind = classifyDnsFeeKind(fee);
            return kind === "late" || kind === "other";
          });
          const nameExemptFees = (participant.fees ?? []).filter(
            (fee) =>
              classifyDnsFeeKind(fee) !== "late" &&
              isFeeNameExempt(data.exemptFeeNames, fee.name),
          );
          const payableParts = [
            {
              label: "Anmälan",
              amount: participant.entryFeeToPaySek,
              flag: "waiveAnmalan" as const,
              waived: waiverFlags.waiveAnmalan,
            },
            {
              label: "Efteranm.",
              amount: participant.lateFeeToPaySek,
              flag: "waiveLate" as const,
              waived: waiverFlags.waiveLate,
            },
            {
              label: "Övrigt",
              amount: participant.otherFeeToPaySek,
              flag: "waiveOther" as const,
              waived: waiverFlags.waiveOther,
            },
            {
              label: "DNS",
              amount: participant.dnsFeeToPaySek,
              flag: "waiveDns" as const,
              waived: waiverFlags.waiveDns,
            },
          ];

          return (
            <li
              key={`${participant.personId}-${participant.entryId}-${participant.className}`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    <Link
                      href={personDetailHref(participant.personId, data.year)}
                      className="link-brand"
                    >
                      {participant.personName}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {participant.className}
                    {youthJunior ? " · ungdom/junior" : ""}
                    {" · "}
                    {statusLabel(participant.status)}
                    {participant.status === "dns" && participant.dnsReason
                      ? ` · Orsak: ${participant.dnsReason}`
                      : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums font-semibold text-slate-800">
                  {participant.feeSek === null ? "–" : `${formatSek(participant.feeSek)} kr`}
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
                        onChange={(event) =>
                          void setManualWaiverFlag(
                            participant.personId,
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
