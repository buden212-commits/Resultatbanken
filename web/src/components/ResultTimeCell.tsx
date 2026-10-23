import { formatTimeForDisplay, isUnreasonableTime } from "@/lib/time";

type Props = {
  time: string | null | undefined;
  /** When set, show status instead of time (single-column layouts). */
  status?: string | null;
  /** Eventor imports skip the unreasonable-time badge. Default true. */
  flagUnreasonable?: boolean;
};

export function ResultTimeCell({ time, status, flagUnreasonable = true }: Props) {
  if (status) {
    return <span>{status}</span>;
  }

  if (!time) {
    return <>–</>;
  }

  const displayTime = formatTimeForDisplay(time) ?? time;

  if (!flagUnreasonable || !isUnreasonableTime(time)) {
    return <>{displayTime}</>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-amber-800">{displayTime}</span>
      <span
        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
        title="Tiden är under 8 minuter eller över 3 timmar och kan vara felaktigt tolkad"
      >
        Orimlig tid
      </span>
    </span>
  );
}
