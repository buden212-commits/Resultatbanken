"use client";

import { useState } from "react";

import { ResultTimeCell } from "@/components/ResultTimeCell";
import {
  formatSecondsToTime,
  isValidCorrectedTime,
  parseTimeToSeconds,
} from "@/lib/time";

type Props = {
  eventId: number;
  personKey: string;
  className: string | null;
  place: number | null;
  initialTime: string;
  canEdit: boolean;
};

export function ResultTimeEditor({
  eventId,
  personKey,
  className,
  place,
  initialTime,
  canEdit,
}: Props) {
  const [time, setTime] = useState(initialTime);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!time) {
    return <>–</>;
  }

  if (!canEdit) {
    return <ResultTimeCell time={time} />;
  }

  const parsedSeconds = parseTimeToSeconds(time);
  const parsedLabel =
    parsedSeconds !== null ? formatSecondsToTime(parsedSeconds) : null;

  async function onSave() {
    const corrected = draft.trim();
    if (!corrected) {
      setError("Ange korrigerad tid.");
      return;
    }
    if (!isValidCorrectedTime(corrected)) {
      setError("Ogiltig tid — ange t.ex. 46:34, 1:05:30 eller 58.23 (8 min–3 tim).");
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/result-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          person_key: personKey,
          class_name: className,
          place,
          time,
          corrected_time: corrected,
        }),
      });

      const body = await response.text();
      let data: {
        error?: string;
        time?: string;
        deploy?: { ok: boolean; message: string };
      };

      try {
        data = body ? (JSON.parse(body) as typeof data) : {};
      } catch {
        setError("Ogiltigt svar från servern.");
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Kunde inte spara tid.");
        return;
      }

      setTime(data.time ?? corrected);
      setDraft("");
      setMessage(
        data.deploy?.ok
          ? "Tid sparad. Uppdateringen syns inom några minuter."
          : (data.deploy?.message ?? "Tid sparad."),
      );
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <ResultTimeCell time={time} />
      {parsedLabel ? (
        <p className="text-xs text-amber-800">Tolkas nu som {parsedLabel}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="t.ex. 46:34 eller 1:05:30"
          disabled={isSaving}
          className="input-field w-36 font-mono text-sm"
          aria-label="Korrigerad tid"
        />
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={isSaving || !draft.trim()}
          className="btn-primary px-3 py-1.5 text-xs"
        >
          {isSaving ? "Sparar…" : "Spara tid"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-xs text-emerald-800">{message}</p> : null}
    </div>
  );
}
