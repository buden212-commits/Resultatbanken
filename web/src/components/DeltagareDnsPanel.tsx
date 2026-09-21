"use client";

import { FormEvent, useMemo, useState } from "react";

type Candidate = {
  personId: string;
  personName: string;
  email: string | null;
};

type DnsRow = {
  eventId: string;
  eventName: string;
  date: string;
  className: string;
  feeSek: number | null;
  dnsReason: string | null;
  dnsReasonAt: string | null;
};

type MePayload = {
  year: number;
  person: Candidate;
  dnsRows: DnsRow[];
};

function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "–";
  const [y, m, d] = date.split("-");
  return `${Number(d)}/${Number(m)} ${y}`;
}

function formatSek(value: number | null): string {
  if (value === null) return "–";
  return `${value.toLocaleString("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} kr`;
}

type Step = "email" | "name" | "pick";

export function DeltagareDnsPanel({ initial }: { initial: MePayload | null }) {
  const [data, setData] = useState<MePayload | null>(initial);
  const [step, setStep] = useState<Step>("email");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);

  const missingReasons = useMemo(
    () => (data?.dnsRows ?? []).filter((row) => !row.dnsReason).length,
    [data],
  );

  async function login(body: Record<string, string>) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/deltagare/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as {
        error?: string;
        needName?: boolean;
        needPick?: boolean;
        candidates?: Candidate[];
        ok?: boolean;
      };

      if (response.ok && json.ok) {
        const me = await fetch("/api/deltagare/me");
        if (!me.ok) throw new Error("Kunde inte hämta dina starter.");
        const payload = (await me.json()) as MePayload;
        setData(payload);
        setDrafts({});
        return;
      }

      if (json.needName) {
        setStep("name");
        setError(json.error || "Ange ditt namn.");
        return;
      }

      if (json.needPick && json.candidates) {
        setCandidates(json.candidates);
        setStep("pick");
        setError(null);
        return;
      }

      throw new Error(json.error || "Inloggningen misslyckades.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inloggningen misslyckades.");
    } finally {
      setLoading(false);
    }
  }

  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    await login({ password, email });
  }

  async function onNameSubmit(event: FormEvent) {
    event.preventDefault();
    await login({ password, name });
  }

  async function onPick(personId: string) {
    await login({ password, personId });
  }

  async function saveReason(eventId: string) {
    const reason = (drafts[eventId] ?? "").trim();
    if (!reason) {
      setError("Ange en orsak innan du sparar.");
      return;
    }
    setSavingEventId(eventId);
    setError(null);
    setSavedEventId(null);
    try {
      const response = await fetch("/api/deltagare/dns-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, reason }),
      });
      const json = (await response.json()) as { error?: string; row?: DnsRow };
      if (!response.ok || !json.row) {
        throw new Error(json.error || "Kunde inte spara orsaken.");
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              dnsRows: prev.dnsRows.map((row) => (row.eventId === eventId ? json.row! : row)),
            }
          : prev,
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      setSavedEventId(eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara orsaken.");
    } finally {
      setSavingEventId(null);
    }
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        {step === "email" ? (
          <form onSubmit={onEmailSubmit} className="card space-y-4 p-6">
            <div>
              <label htmlFor="deltagare-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                E-post
              </label>
              <input
                id="deltagare-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input-field"
                placeholder="namn@exempel.se"
              />
            </div>
            <div>
              <label
                htmlFor="deltagare-password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Deltagarlösenord
              </label>
              <input
                id="deltagare-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input-field"
              />
            </div>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Loggar in…" : "Logga in"}
            </button>
          </form>
        ) : null}

        {step === "name" ? (
          <form onSubmit={onNameSubmit} className="card space-y-4 p-6">
            <p className="text-sm text-slate-600">
              Ingen träff på e-post. Ange ditt namn som det står i Eventor (för- och efternamn).
            </p>
            <div>
              <label htmlFor="deltagare-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Namn
              </label>
              <input
                id="deltagare-name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input-field"
                placeholder="Förnamn Efternamn"
              />
            </div>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
              >
                Tillbaka
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? "Söker…" : "Fortsätt"}
              </button>
            </div>
          </form>
        ) : null}

        {step === "pick" ? (
          <div className="card space-y-4 p-6">
            <p className="text-sm text-slate-600">Flera personer matchade. Välj dig själv:</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {candidates.map((candidate) => (
                <li key={candidate.personId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm hover:bg-slate-50"
                    disabled={loading}
                    onClick={() => void onPick(candidate.personId)}
                  >
                    <span className="font-medium text-slate-800">{candidate.personName}</span>
                    <span className="text-slate-400">{candidate.email || "ingen e-post"}</span>
                  </button>
                </li>
              ))}
            </ul>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              className="text-sm text-brand-700 hover:underline"
              onClick={() => {
                setStep("name");
                setError(null);
              }}
            >
              Tillbaka
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">{data.person.personName}</p>
          <p className="text-sm text-slate-500">
            {data.year} · {data.dnsRows.length} ej start
            {missingReasons > 0 ? ` · ${missingReasons} utan orsak` : ""}
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() =>
            void fetch("/api/deltagare/logout", { method: "POST" }).then(() => {
              setData(null);
              setStep("email");
              setPassword("");
              setEmail("");
              setName("");
              setCandidates([]);
              setError(null);
            })
          }
        >
          Logga ut
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {data.dnsRows.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-slate-500">
          Inga registrerade ej start (DNS) just nu.
        </p>
      ) : (
        <ul className="space-y-4">
          {data.dnsRows.map((row) => {
            const draft = drafts[row.eventId] ?? row.dnsReason ?? "";
            const saving = savingEventId === row.eventId;
            return (
              <li key={row.eventId} className="card space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{row.eventName}</p>
                    <p className="text-sm text-slate-500">
                      {formatDate(row.date)}
                      {row.className !== "–" ? ` · ${row.className}` : ""}
                      {row.feeSek !== null ? ` · ${formatSek(row.feeSek)}` : ""}
                    </p>
                  </div>
                  {row.dnsReason ? (
                    <span className="text-xs font-medium text-emerald-700">Orsak sparad</span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700">Orsak saknas</span>
                  )}
                </div>
                <label className="block text-sm font-medium text-slate-700" htmlFor={`reason-${row.eventId}`}>
                  Orsak till ej start
                </label>
                <textarea
                  id={`reason-${row.eventId}`}
                  className="input-field min-h-[5rem]"
                  maxLength={500}
                  value={draft}
                  onChange={(event) =>
                    setDrafts((prev) => ({ ...prev, [row.eventId]: event.target.value }))
                  }
                  placeholder="T.ex. sjukdom, skada, transport…"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={saving || !draft.trim()}
                    onClick={() => void saveReason(row.eventId)}
                  >
                    {saving ? "Sparar…" : row.dnsReason ? "Uppdatera orsak" : "Spara orsak"}
                  </button>
                  {savedEventId === row.eventId ? (
                    <span className="text-sm text-emerald-700">Sparat.</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
