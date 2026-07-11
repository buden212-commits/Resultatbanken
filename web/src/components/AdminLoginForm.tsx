"use client";

import { FormEvent, useState } from "react";

export function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Inloggning misslyckades.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-md space-y-4 p-6">
      <div>
        <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Lösenord
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input-field"
          required
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={isLoading}>
        {isLoading ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}
