"use client";

import { FormEvent, useMemo, useState } from "react";

import type { TypeAliasGroup } from "@/lib/types";

type TypeOption = {
  type_key: string;
  display_type: string;
  event_count: number;
};

type Props = {
  types: TypeOption[];
  existingGroups: TypeAliasGroup[];
};

export function TypeAliasForm({ types, existingGroups: initialGroups }: Props) {
  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [canonicalKey, setCanonicalKey] = useState("");
  const [existingGroups, setExistingGroups] = useState(initialGroups);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const linkedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const group of existingGroups) {
      keys.add(group.canonical_key);
      for (const alias of group.alias_keys) {
        keys.add(alias);
      }
    }
    return keys;
  }, [existingGroups]);

  const availableTypes = useMemo(
    () => types.filter((type) => !linkedKeys.has(type.type_key)),
    [types, linkedKeys],
  );

  const filteredTypes = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = normalized
      ? availableTypes.filter((type) => type.display_type.toLowerCase().includes(normalized))
      : availableTypes;
    return [...list].sort((a, b) => a.display_type.localeCompare(b.display_type, "sv"));
  }, [availableTypes, search]);

  const selectedTypes = useMemo(
    () => types.filter((type) => selectedKeys.includes(type.type_key)),
    [types, selectedKeys],
  );

  function toggleType(typeKey: string) {
    setSelectedKeys((current) => {
      if (current.includes(typeKey)) {
        const next = current.filter((key) => key !== typeKey);
        if (canonicalKey === typeKey) {
          setCanonicalKey(next[0] ?? "");
        }
        return next;
      }
      const next = [...current, typeKey];
      if (!canonicalKey) {
        setCanonicalKey(typeKey);
      }
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const displayName = selectedTypes.find((type) => type.type_key === canonicalKey)?.display_type;
    if (!displayName) {
      setError("Välj vilken typ som ska gälla till höger.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/type-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_keys: selectedKeys,
          canonical_key: canonicalKey,
          display_name: displayName,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        deploy?: { ok: boolean; message: string };
      };

      if (!response.ok) {
        setError(data.error ?? "Kunde inte spara typkoppling.");
        return;
      }

      setMessage(
        data.deploy?.ok
          ? "Typkoppling sparad. Sidan uppdateras inom några minuter."
          : (data.deploy?.message ?? "Typkoppling sparad."),
      );
      setSelectedKeys([]);
      setCanonicalKey("");
      window.location.reload();
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onDeleteGroup(groupCanonicalKey: string) {
    if (!window.confirm("Ta bort denna typkoppling?")) {
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/type-aliases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical_key: groupCanonicalKey }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Kunde inte ta bort typkoppling.");
        return;
      }

      setExistingGroups((current) => current.filter((group) => group.canonical_key !== groupCanonicalKey));
      setMessage("Typkoppling borttagen.");
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-base font-semibold text-slate-900">Välj typer att slå ihop</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sök och kryssa i alla varianter som är samma typ (t.ex. Tränings-OL och Tränings ol).
          </p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sök typ…"
            className="input-field mt-4"
          />
          <ul className="mt-4 max-h-[28rem] space-y-1 overflow-y-auto">
            {filteredTypes.map((type) => {
              const checked = selectedKeys.includes(type.type_key);
              return (
                <li key={type.type_key}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition ${
                      checked ? "bg-brand-50 text-brand-800" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(type.type_key)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    <span className="flex-1 font-medium">{type.display_type}</span>
                    <span className="text-xs text-slate-500">{type.event_count} event</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="text-base font-semibold text-slate-900">Slå ihop till</h2>
          <p className="mt-1 text-sm text-slate-600">Välj vilken typ som ska visas i systemet.</p>

          {selectedTypes.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">Kryssa i minst två typer till vänster.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {selectedTypes.map((type) => (
                <li key={type.type_key}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                      canonicalKey === type.type_key
                        ? "border-brand-300 bg-brand-50"
                        : "border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="canonical-type"
                      checked={canonicalKey === type.type_key}
                      onChange={() => setCanonicalKey(type.type_key)}
                      className="h-4 w-4 border-slate-300 text-brand-600"
                    />
                    <span className="font-medium">{type.display_type}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
          ) : null}

          <button
            type="submit"
            className="btn-primary mt-6 w-full"
            disabled={isSaving || selectedTypes.length < 2 || !canonicalKey}
          >
            {isSaving ? "Sparar…" : "Spara typkoppling"}
          </button>
        </div>
      </form>

      {existingGroups.length > 0 ? (
        <section className="card p-5">
          <h2 className="text-base font-semibold text-slate-900">Befintliga typkopplingar</h2>
          <ul className="mt-4 space-y-3">
            {existingGroups.map((group) => (
              <li
                key={group.canonical_key}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{group.display_name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Alias:{" "}
                    {group.alias_keys.length > 0
                      ? group.alias_keys
                          .map(
                            (alias) =>
                              types.find((type) => type.type_key === alias)?.display_type ?? alias,
                          )
                          .join(", ")
                      : "–"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onDeleteGroup(group.canonical_key)}
                  className="text-sm font-medium text-red-600 transition hover:text-red-700"
                  disabled={isSaving}
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
