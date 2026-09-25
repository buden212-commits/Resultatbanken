import type { DnsFeePersonSummary, DnsFeeRow } from "./dns-fee-types";
import { normalizeDnsFeeStatus, rowPayableSplit, type DnsFeeTrackerData } from "./dns-fee-types";

function formatSek(value: number): string {
  return `${value.toLocaleString("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} kr`;
}

function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "–";
  const [y, m, d] = date.split("-");
  return `${Number(d)}/${Number(m)} ${y}`;
}

function statusLabel(status: string): string {
  switch (normalizeDnsFeeStatus(status)) {
    case "ok":
      return "Fullföljd";
    case "dns":
      return "Ej start (DNS)";
    case "dnf":
      return "Ej fullföljd (DNF)";
    case "entered":
      return "Anmäld";
    default:
      return status;
  }
}

function sortRows(rows: DnsFeeRow[]): DnsFeeRow[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.eventName.localeCompare(b.eventName, "sv");
  });
}

/** Build a mailto: URL for the participant's fee summary (opens local mail client). */
export function buildFeeMailtoLink(
  person: DnsFeePersonSummary,
  exemptEventIds: string[],
  year = 2026,
): string | null {
  if (!person.email) return null;

  const tracker: DnsFeeTrackerData = {
    year,
    importedAt: null,
    rows: person.rows,
    members: [],
    exemptEventIds,
  };

  const lines: string[] = [
    `Hej ${person.personName},`,
    "",
    `Här är en sammanställning av startavgifter för IFK Mora OK ${year}.`,
    "",
    "Sammanfattning",
    `• Anmälan (ordinarie): ${formatSek(person.entryFeeToPaySek)}`,
    `• Efteranmälan: ${formatSek(person.lateFeeToPaySek)}`,
    `• Övriga tillägg: ${formatSek(person.otherFeeToPaySek)}`,
    `• Ej start (DNS): ${formatSek(person.dnsFeeToPaySek)}`,
    `• Totalt att betala: ${formatSek(person.totalToPaySek)}`,
  ];

  const payableRows = sortRows(person.rows).filter((row) => {
    const split = rowPayableSplit(tracker, row);
    return (
      split.entryFeeToPaySek > 0 ||
      split.lateFeeToPaySek > 0 ||
      split.otherFeeToPaySek > 0 ||
      split.dnsFeeToPaySek > 0
    );
  });

  if (payableRows.length > 0) {
    lines.push("", "Detaljer");
    for (const row of payableRows) {
      const split = rowPayableSplit(tracker, row);
      const parts = [
        formatDate(row.date),
        row.eventName,
        row.className !== "–" ? row.className : null,
        statusLabel(row.status),
      ].filter(Boolean);
      const amounts: string[] = [];
      if (split.entryFeeToPaySek > 0) amounts.push(`anmälan ${formatSek(split.entryFeeToPaySek)}`);
      if (split.lateFeeToPaySek > 0) amounts.push(`efteranmälan ${formatSek(split.lateFeeToPaySek)}`);
      if (split.otherFeeToPaySek > 0) amounts.push(`övrigt ${formatSek(split.otherFeeToPaySek)}`);
      if (split.dnsFeeToPaySek > 0) amounts.push(`ej start ${formatSek(split.dnsFeeToPaySek)}`);
      lines.push(`• ${parts.join(" · ")} — ${amounts.join(", ")}`);
    }
  }

  lines.push("", "Med vänlig hälsning", "IFK Mora OK");

  const subject = "Startavgifter och Ej start";
  const body = lines.join("\r\n");
  return `mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
