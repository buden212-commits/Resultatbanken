"use client";

import { FormEvent, useMemo, useState } from "react";

import type { PersonAliasGroup } from "@/lib/types";

type PersonOption = {
  person_key: string;
  display_name: string;
  result_count: number;
};

type Props = {
  people: PersonOption[];
  existingGroups: PersonAliasGroup[];
};

export function PersonAliasForm({ people, existingGroups: initialGroups }: Props) {
  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [canonicalKey, setCanonicalKey] = useState("");
  const [existingGroups, setExistingGroups] = useState(initialGroups);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const filteredPeople = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = normalized
      ? people.filter((person) => person.display_name.toLowerCase().includes(normalized))
      : people;
    return [...list].sort((a, b) => a.display_name.localeCompare(b.display_name, "sv"));
  }, [people, search]);

  const selectedPeople = useMemo(
    () => people.filter((person) => selectedKeys.includes(person.person_key)),
    [people, selectedKeys],
  );

  function togglePerson(personKey: string) {
    setSelectedKeys((current) => {
      if (current.includes(personKey)) {
        const next = current.filter((key) => key !== personKey);
        if (canonicalKey === personKey) {
          setCanonicalKey(next[0] ?? "");
        }
        return next;
      }
      const next = [...current, personKey];
      if (!canonicalKey) {
        setCanonicalKey(personKey);
      }
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const displayName = selectedPeople.find((person) => person.person_key === canonicalKey)?.display_name;
    if (!displayName) {
      setError("Välj vilket namn som ska gälla till höger.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/person-aliases", {
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
        group_count?: number;
        deploy?: { ok: boolean; message: string };
      };

      if (!response.ok) {
        setError(data.error ?? "Kunde inte spara namnkoppling.");
        return;
      }

      setMessage(
        data.deploy?.ok
          ? "Namnkoppling sparad. Sidan uppdateras inom några minuter."
          : (data.deploy?.message ?? "Namnkoppling sparad."),
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
    if (!window.confirm("Ta bort denna namnkoppling?")) {
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/person-aliases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical_key: groupCanonicalKey }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Kunde inte ta bort namnkoppling.");
        return;
      }

      setExistingGroups((current) => current.filter((group) => group.canonical_key !== groupCanonicalKey));
      setMessage("Namnkoppling borttagen.");
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
          <h2 className="text-base font-semibold text-slate-900">Välj namn att slå ihop</h2>
          <p className="mt-1 text-sm text-slate-600">Sök och kryssa i alla stavningar som är samma person.</p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sök namn…"
            className="input-field mt-4"
          />
          <ul className="mt-4 max-h-[28rem] space-y-1 overflow-y-auto">
            {filteredPeople.map((person) => {
              const checked = selectedKeys.includes(person.person_key);
              return (
                <li key={person.person_key}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition ${
                      checked ? "bg-brand-50 text-brand-800" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePerson(person.person_key)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    <span className="flex-1 font-medium">{person.display_name}</span>
                    <span className="text-xs text-slate-500">{person.result_count} st</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="text-base font-semibold text-slate-900">Slå ihop till</h2>
          <p className="mt-1 text-sm text-slate-600">Välj vilket namn som ska visas i systemet.</p>

          {selectedPeople.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">Kryssa i minst två namn till vänster.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {selectedPeople.map((person) => (
                <li key={person.person_key}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                      canonicalKey === person.person_key
                        ? "border-brand-300 bg-brand-50"
                        : "border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="canonical"
                      checked={canonicalKey === person.person_key}
                      onChange={() => setCanonicalKey(person.person_key)}
                      className="h-4 w-4 border-slate-300 text-brand-600"
                    />
                    <span className="font-medium">{person.display_name}</span>
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
            disabled={isSaving || selectedPeople.length < 2 || !canonicalKey}
          >
            {isSaving ? "Sparar…" : "Spara namnkoppling"}
          </button>
        </div>
      </form>

      {existingGroups.length > 0 ? (
        <section className="card p-5">
          <h2 className="text-base font-semibold text-slate-900">Befintliga kopplingar</h2>
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
                          .map((alias) => people.find((person) => person.person_key === alias)?.display_name ?? alias)
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
