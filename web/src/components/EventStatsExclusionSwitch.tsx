"use client";

import { useState } from "react";

type Props = {
  eventId: number;
  initialExcluded: boolean;
  canEdit: boolean;
};

export function EventStatsExclusionSwitch({ eventId, initialExcluded, canEdit }: Props) {
  const [excluded, setExcluded] = useState(initialExcluded);
  const [included, setIncluded] = useState(!initialExcluded);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onToggle(nextIncluded: boolean) {
    if (!canEdit || isSaving) {
      return;
    }

    const nextExcluded = !nextIncluded;
    setIncluded(nextIncluded);
    setExcluded(nextExcluded);
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/stats-exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, excluded: nextExcluded }),
      });

      const data = (await response.json()) as {
        error?: string;
        deploy?: { ok: boolean; message: string };
      };

      if (!response.ok) {
        setIncluded(!nextIncluded);
        setExcluded(!nextExcluded);
        setError(data.error ?? "Kunde inte spara.");
        return;
      }

      setMessage(
        data.deploy?.ok
          ? nextExcluded
            ? "Exkluderat från statistik. Uppdateringen syns inom några minuter."
            : "Inkluderat i statistik igen. Uppdateringen syns inom några minuter."
          : (data.deploy?.message ?? "Inställning sparad."),
      );
    } catch {
      setIncluded(!nextIncluded);
      setExcluded(!nextExcluded);
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!canEdit && !excluded) {
    return null;
  }

  return (
    <div
      className={`mt-4 rounded-xl border px-4 py-3 ${
        excluded ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Statistik</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {excluded
              ? "Detta resultat räknas inte med i statistik och topplistor."
              : "Detta resultat ingår i statistik och topplistor."}
          </p>
        </div>

        {canEdit ? (
          <label className="flex cursor-pointer items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Inkludera i statistik</span>
            <button
              type="button"
              role="switch"
              aria-checked={included}
              disabled={isSaving}
              onClick={() => void onToggle(!included)}
              className={`relative h-7 w-12 rounded-full transition ${
                included ? "bg-brand-600" : "bg-slate-300"
              } ${isSaving ? "opacity-60" : ""}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  included ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Exkluderat från statistik
          </span>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
    </div>
  );
}
