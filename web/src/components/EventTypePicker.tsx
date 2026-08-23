"use client";

import { useMemo, useState } from "react";

import { TypeBadge } from "@/components/ui";

type Props = {
  eventId: number;
  initialType: string;
  initialDisplayType: string;
  canEdit: boolean;
  availableTypes: string[];
};

export function EventTypePicker({
  eventId,
  initialType,
  initialDisplayType,
  canEdit,
  availableTypes,
}: Props) {
  const [currentType, setCurrentType] = useState(initialType.trim());
  const [displayType, setDisplayType] = useState(initialDisplayType);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const filteredTypes = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return availableTypes;
    }
    return availableTypes.filter((type) => type.toLowerCase().includes(normalized));
  }, [availableTypes, search]);

  async function selectType(type: string) {
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/event-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, type }),
      });

      const data = (await response.json()) as {
        error?: string;
        type?: string;
        deploy?: { ok: boolean; message: string };
      };

      if (!response.ok) {
        setError(data.error ?? "Kunde inte spara typ.");
        return;
      }

      setCurrentType(data.type ?? type);
      setDisplayType(data.type ?? type);
      setOpen(false);
      setSearch("");
      setMessage(
        data.deploy?.ok
          ? "Typ sparad. Sidan uppdateras inom några minuter."
          : (data.deploy?.message ?? "Typ sparad."),
      );
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsSaving(false);
    }
  }

  if (currentType) {
    return (
      <div className="relative">
        <TypeBadge label={displayType} />
        {message ? (
          <p className="absolute right-0 top-full z-10 mt-2 w-64 text-xs text-emerald-700">{message}</p>
        ) : null}
      </div>
    );
  }

  if (!canEdit) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={isSaving}
        className="badge cursor-pointer transition hover:bg-brand-100 hover:text-brand-800"
      >
        Ange typ
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sök typ…"
            className="input-field"
            autoFocus
          />
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {filteredTypes.length === 0 ? (
              <li className="px-2 py-2 text-sm text-slate-500">Ingen typ hittades.</li>
            ) : (
              filteredTypes.map((type) => (
                <li key={type}>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void selectType(type)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-800 transition hover:bg-brand-50"
                  >
                    {type}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="absolute right-0 top-full z-10 mt-2 w-64 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!open && message ? (
        <p className="absolute right-0 top-full z-10 mt-2 w-64 text-xs text-emerald-700">{message}</p>
      ) : null}
    </div>
  );
}
