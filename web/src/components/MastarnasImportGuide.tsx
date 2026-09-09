"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatPoints } from "@/lib/mastarnas-points";
import type { MastarnasClass, MastarnasDiscipline } from "@/lib/mastarnas-types";

type ArchiveHit = {
  id: number;
  name: string;
  type: string;
  date: string;
  location: string;
};

type SourceClass = {
  source: string;
  cleaned: string;
  count: number;
  suggested_class_id: string;
  hint?: string;
};

type PreviewGroup = {
  class_id: string;
  class_name: string;
  rows: {
    name: string;
    person_key: string;
    place: number | null;
    status: string;
    time: string | null;
    source_class: string;
    points: number;
  }[];
};

type Props = {
  years: number[];
  classes: MastarnasClass[];
  disciplines: MastarnasDiscipline[];
  initialEventId?: number;
  initialYear?: number;
};

export function MastarnasImportGuide({ years, classes, disciplines, initialEventId, initialYear }: Props) {
  const mmClasses = classes.filter((item) => item.id !== "okand");
  const [query, setQuery] = useState(initialEventId ? String(initialEventId) : "");
  const [hits, setHits] = useState<ArchiveHit[]>([]);
  const [selected, setSelected] = useState<ArchiveHit | null>(null);
  const [sourceClasses, setSourceClasses] = useState<SourceClass[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [year, setYear] = useState(String(initialYear || years[0] || new Date().getFullYear()));
  const [disciplineId, setDisciplineId] = useState(disciplines[0]?.id ?? "");
  const [preview, setPreview] = useState<{ groups: PreviewGroup[]; skipped: number; unmapped: number } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const mappingKey = (item: SourceClass) => item.cleaned || item.source;
  const mappedCount = useMemo(
    () => sourceClasses.filter((item) => mapping[mappingKey(item)]).length,
    [sourceClasses, mapping],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void searchEvents(query);
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial search only from query
  }, [query]);

  useEffect(() => {
    if (initialEventId) {
      void loadEvent(initialEventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEventId]);

  async function searchEvents(text: string) {
    try {
      const response = await fetch(`/api/admin/mastarnas?search=${encodeURIComponent(text)}`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { events: ArchiveHit[] };
      setHits(data.events);
    } catch {
      setHits([]);
    }
  }

  async function loadEvent(eventId: number) {
    setError("");
    setMessage("");
    setPreview(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/mastarnas?preview_event=${eventId}`);
      const data = (await response.json()) as {
        error?: string;
        event: ArchiveHit;
        suggested_year: number | null;
        suggested_discipline_id: string;
        source_classes: SourceClass[];
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Kunde inte läsa resultatet.");
      }
      setSelected(data.event);
      setSourceClasses(data.source_classes);
      setMapping(Object.fromEntries(data.source_classes.map((item) => [item.cleaned || item.source, item.suggested_class_id])));
      if (data.suggested_year) {
        setYear(String(data.suggested_year));
      }
      if (data.suggested_discipline_id) {
        setDisciplineId(data.suggested_discipline_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa resultatet.");
    } finally {
      setIsLoading(false);
    }
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/mastarnas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      error?: string;
      groups?: PreviewGroup[];
      skipped?: number;
      unmapped?: number;
      deploy?: { ok: boolean; message: string };
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Något gick fel.");
    }
    return data;
  }

  const yearExists = years.includes(Number(year));

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <section className="card space-y-3 p-5">
        <p className="font-medium text-slate-800">1. Välj resultat från arkivet</p>
        <p className="text-sm text-slate-600">
          Sök på namn, typ, plats, år eller id — t.ex. <span className="font-medium">medel 2013</span>. Utan sökord visas
          senaste KM. MeOS-klasser som <span className="font-mono">D10 (2 / 2) Tid Efter Bomtid</span> rensas
          automatiskt till D10.
        </p>
        <input
          className="input-field"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="t.ex. Medel-KM 2013 eller 631"
          aria-label="Sök resultat i arkivet"
        />
        {hits.length === 0 && !isLoading ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
            {query.trim() ? "Inga resultat matchade sökningen." : "Inga KM hittades."}
          </p>
        ) : (
          <ul className="max-h-64 divide-y divide-slate-100 overflow-auto rounded-xl ring-1 ring-slate-200">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                    selected?.id === hit.id ? "bg-brand-50" : ""
                  }`}
                  onClick={() => void loadEvent(hit.id)}
                >
                  <span className="font-medium text-slate-800">
                    {hit.name} <span className="text-slate-400">#{hit.id}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {hit.date} · {hit.type} · {hit.location}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <>
          <section className="card space-y-4 p-5">
            <p className="font-medium text-slate-800">2. År och gren i Mästarnas Mästare</p>
            <p className="text-sm text-slate-600">
              {selected.name} ({selected.date}) föreslås som{" "}
              <span className="font-medium">{disciplines.find((item) => item.id === disciplineId)?.name ?? disciplineId}</span>.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">År</label>
                <input className="input-field" type="number" min={1990} max={2100} value={year} onChange={(event) => setYear(event.target.value)} />
                {!yearExists ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-brand-700 hover:text-brand-900"
                    disabled={isLoading}
                    onClick={() => {
                      setError("");
                      setMessage("");
                      setIsLoading(true);
                      void post({ action: "createSeason", year: Number(year) })
                        .then((data) => {
                          setMessage(data.deploy?.message ?? `År ${year} skapat.`);
                          window.location.href = `/mastarnas/importera?event=${selected.id}&year=${year}`;
                        })
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Kunde inte skapa år."))
                        .finally(() => setIsLoading(false));
                    }}
                  >
                    Skapa år {year} först
                  </button>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Gren</label>
                <select className="input-field" value={disciplineId} onChange={(event) => setDisciplineId(event.target.value)}>
                  {disciplines.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <p className="font-medium text-slate-800">3. Översätt klasser</p>
            <p className="text-sm text-slate-600">
              Koppla varje klass i resultatfilen till en MM-klass. Lämna tomt för att hoppa över (t.ex. inskolning).
              DNS tas inte med. Felstämpling räknas som DNF (10 p). {mappedCount} av {sourceClasses.length} klasser är
              kopplade. Saknas en klass i listan kan du lägga till den under administrera på{" "}
              <Link href={yearExists ? `/mastarnas/${year}` : "/mastarnas"} className="link-brand">
                års-sidan
              </Link>
              .
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3">I arkivet</th>
                    <th className="py-2 pr-3">Tolkad som</th>
                    <th className="py-2 pr-3">Antal</th>
                    <th className="py-2">MM-klass</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceClasses.map((item) => {
                    const key = mappingKey(item);
                    return (
                      <tr key={key} className="border-t border-slate-100">
                        <td className="max-w-[16rem] truncate py-2 pr-3 text-slate-500" title={item.source}>
                          {item.source}
                        </td>
                        <td className="py-2 pr-3 font-medium">{item.cleaned || "–"}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-600">{item.count}</td>
                        <td className="py-2">
                          <select
                            className="input-field"
                            value={mapping[key] ?? ""}
                            onChange={(event) => {
                              setPreview(null);
                              setMapping({ ...mapping, [key]: event.target.value });
                            }}
                          >
                            <option value="">Hoppa över</option>
                            {mmClasses.map((klass) => (
                              <option key={klass.id} value={klass.id}>
                                {klass.name}
                              </option>
                            ))}
                          </select>
                          {item.hint ? <p className="mt-1 text-xs text-slate-500">{item.hint}</p> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={isLoading || mappedCount === 0}
              onClick={() => {
                setError("");
                setMessage("");
                setIsLoading(true);
                void post({ action: "previewImport", archive_event_id: selected.id, mapping })
                  .then((data) => {
                    setPreview({
                      groups: data.groups ?? [],
                      skipped: data.skipped ?? 0,
                      unmapped: data.unmapped ?? 0,
                    });
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : "Kunde inte förhandsvisa."))
                  .finally(() => setIsLoading(false));
              }}
            >
              {isLoading ? "Läser…" : "Förhandsvisa poäng"}
            </button>
          </section>
        </>
      ) : null}

      {preview && selected ? (
        <section className="card space-y-5 p-5">
          <p className="font-medium text-slate-800">4. Kontrollera och spara</p>
          <p className="text-sm text-slate-600">
            {preview.groups.reduce((sum, group) => sum + group.rows.length, 0)} resultat i {preview.groups.length}{" "}
            klasser. {preview.skipped ? `${preview.skipped} DNS hoppades över. ` : ""}
            {preview.unmapped ? `${preview.unmapped} rader utan klasskoppling hoppades över.` : ""}
            Placeringar tas från arkivet; om flera arkivklasser kopplas till samma MM-klass räknas tid om.
            Befintliga resultat i samma gren och klasser skrivs över.
          </p>
          {preview.groups.map((group) => (
            <div key={group.class_id}>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">{group.class_name}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                      <th className="py-1 pr-3">Plac</th>
                      <th className="py-1 pr-3">Namn</th>
                      <th className="py-1 pr-3">Tid</th>
                      <th className="py-1 pr-3">Status</th>
                      <th className="py-1">Poäng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.person_key} className="border-t border-slate-100">
                        <td className="py-1 pr-3 tabular-nums">{row.place ?? ""}</td>
                        <td className="py-1 pr-3">{row.name}</td>
                        <td className="py-1 pr-3 font-mono tabular-nums text-slate-600">{row.time ?? ""}</td>
                        <td className="py-1 pr-3 text-slate-500">{row.status === "ok" ? "" : row.status.toUpperCase()}</td>
                        <td className="py-1 font-mono tabular-nums">{formatPoints(row.points)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn-primary"
            disabled={isLoading || !yearExists || preview.groups.length === 0}
            onClick={() => {
              setError("");
              setMessage("");
              setIsLoading(true);
              void post({
                action: "importFromArchive",
                year: Number(year),
                discipline_id: disciplineId,
                archive_event_id: selected.id,
                mapping,
              })
                .then((data) => {
                  setMessage(data.deploy?.message ?? "Importerat.");
                  window.location.href = `/mastarnas/${year}?gren=${encodeURIComponent(disciplineId)}`;
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Kunde inte spara."))
                .finally(() => setIsLoading(false));
            }}
          >
            {isLoading ? "Sparar…" : `Spara i ${year}`}
          </button>
          <p className="text-xs text-slate-500">
            Klassöversättningen sparas och föreslås nästa gång.{" "}
            <Link href={`/resultat/${selected.id}`} className="link-brand">
              Öppna originalresultatet
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
