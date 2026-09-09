"use client";

import { useMemo, useState } from "react";

import { MastarnasClassSection } from "@/components/MastarnasClassSection";
import type { MastarnasClass, MastarnasEvent } from "@/lib/mastarnas-types";

function classLabel(classes: MastarnasClass[], classId: string): string {
  return classes.find((item) => item.id === classId)?.name ?? classId;
}

function sortClassIds(classIds: string[], classes: MastarnasClass[]): string[] {
  return [...classIds].sort((a, b) => classLabel(classes, a).localeCompare(classLabel(classes, b), "sv"));
}

export function MastarnasEventResults({
  year,
  event,
  classes,
  canEdit,
}: {
  year: number;
  event: MastarnasEvent;
  classes: MastarnasClass[];
  canEdit: boolean;
}) {
  const [addedClassIds, setAddedClassIds] = useState<string[]>([]);
  const [extraClasses, setExtraClasses] = useState<MastarnasClass[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [newClassYouth, setNewClassYouth] = useState(false);
  const [eventDate, setEventDate] = useState(event.date);
  const [error, setError] = useState("");
  const [dateMessage, setDateMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);

  const allClasses = useMemo(() => {
    const next = [...classes];
    for (const klass of extraClasses) {
      if (!next.some((item) => item.id === klass.id)) {
        next.push(klass);
      }
    }
    return next;
  }, [classes, extraClasses]);

  const usedClassIds = useMemo(
    () => sortClassIds([...new Set(event.results.map((result) => result.class_id))], allClasses),
    [allClasses, event.results],
  );

  const visibleClassIds = useMemo(
    () => [...usedClassIds, ...addedClassIds.filter((id) => !usedClassIds.includes(id))],
    [addedClassIds, usedClassIds],
  );

  const missingClasses = allClasses.filter(
    (item) => item.id !== "okand" && !visibleClassIds.includes(item.id),
  );

  function addClass(classId: string) {
    setError("");
    setAddedClassIds((current) => (current.includes(classId) ? current : [...current, classId]));
  }

  function dismissClass(classId: string) {
    setAddedClassIds((current) => current.filter((id) => id !== classId));
  }

  async function saveDate() {
    setError("");
    setDateMessage("");
    setIsSavingDate(true);
    try {
      const response = await fetch("/api/admin/mastarnas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertEvent",
          year,
          discipline_id: event.discipline_id,
          date: eventDate,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Kunde inte spara datum.");
      }
      setDateMessage("Datum sparat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara datum.");
    } finally {
      setIsSavingDate(false);
    }
  }

  async function createClass() {
    const name = newClassName.trim();
    if (!name) {
      setError("Ange ett klassnamn.");
      return;
    }
    setError("");
    setIsCreating(true);
    try {
      const response = await fetch("/api/admin/mastarnas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addClass", name, is_youth: newClassYouth }),
      });
      const data = (await response.json()) as { error?: string; klass?: MastarnasClass };
      if (!response.ok || !data.klass) {
        throw new Error(data.error ?? "Kunde inte lägga till klassen.");
      }
      setExtraClasses((current) => [...current, data.klass!]);
      setAddedClassIds((current) => (current.includes(data.klass!.id) ? current : [...current, data.klass!.id]));
      setNewClassName("");
      setNewClassYouth(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte lägga till klassen.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {canEdit ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            void saveDate();
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Datum</label>
            <input
              type="date"
              className="input-field"
              value={eventDate}
              onChange={(changeEvent) => {
                setEventDate(changeEvent.target.value);
                setDateMessage("");
              }}
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            disabled={isSavingDate}
          >
            {isSavingDate ? "Sparar…" : "Spara datum"}
          </button>
          {dateMessage ? <p className="pb-2 text-sm text-emerald-800">{dateMessage}</p> : null}
        </form>
      ) : null}

      {visibleClassIds.length === 0 ? (
        <div className="card px-6 py-12 text-center text-slate-500">
          Inga resultat registrerade i {event.name} {year} ännu.
          {canEdit ? " Lägg till en klass nedan och fyll i deltagare." : ""}
        </div>
      ) : (
        visibleClassIds.map((classId) => {
          const rows = event.results
            .filter((result) => result.class_id === classId)
            .sort((a, b) => {
              if (a.place !== null && b.place !== null && a.place !== b.place) {
                return a.place - b.place;
              }
              if (a.place !== null && b.place === null) {
                return -1;
              }
              if (a.place === null && b.place !== null) {
                return 1;
              }
              return a.name.localeCompare(b.name, "sv");
            });
          const isNew = rows.length === 0 && addedClassIds.includes(classId);

          return (
            <MastarnasClassSection
              key={classId}
              year={year}
              eventId={event.id}
              classId={classId}
              className={classLabel(allClasses, classId)}
              results={rows}
              canEdit={canEdit}
              startEditing={isNew}
              onDismiss={isNew ? () => dismissClass(classId) : undefined}
            />
          );
        })
      )}

      {canEdit ? (
        <section className="card space-y-4 p-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Lägg till klass</h3>
            <p className="mt-1 text-sm text-slate-600">
              Klasser som ingår i Mästarnas Mästare men saknas i den här grenen.
            </p>
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {missingClasses.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {missingClasses.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:text-brand-800"
                  onClick={() => addClass(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Alla befintliga MM-klasser finns redan i listan.</p>
          )}

          <form
            className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void createClass();
            }}
          >
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Ny klass</label>
              <input
                className="input-field"
                value={newClassName}
                onChange={(event) => setNewClassName(event.target.value)}
                placeholder="t.ex. D80"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={newClassYouth}
                onChange={(event) => setNewClassYouth(event.target.checked)}
              />
              Ungdom
            </label>
            <button type="submit" className="btn-primary shrink-0" disabled={isCreating}>
              {isCreating ? "Lägger till…" : "Skapa klass"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
