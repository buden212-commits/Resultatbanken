"use client";

import { KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";

type Suggestion = {
  person_key: string;
  display_name: string;
  result_count: number;
};

type Props = {
  value: string;
  personKey: string;
  onChange: (value: { name: string; person_key: string }) => void;
};

export function PersonNamePicker({ value, personKey, onChange }: Props) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = value.trim();
  const showSuggestions = isOpen && trimmed.length >= 2 && suggestions.length > 0;

  const fetchSuggestions = useCallback(async (query: string) => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(normalized)}`);
      if (!response.ok) {
        setSuggestions([]);
        return;
      }
      const data = (await response.json()) as { results: Suggestion[] };
      setSuggestions(data.results);
      setIsOpen(data.results.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSuggestions(value);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [value, fetchSuggestions]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(suggestion: Suggestion) {
    onChange({ name: suggestion.display_name, person_key: suggestion.person_key });
    setIsOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index < suggestions.length - 1 ? index + 1 : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index > 0 ? index - 1 : suggestions.length - 1));
    } else if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange({ name: event.target.value, person_key: "" })}
        onFocus={() => {
          if (trimmed.length >= 2 && suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={onKeyDown}
        placeholder="Sök eller skriv nytt namn"
        className="input-field"
      />
      {personKey ? (
        <p className="mt-1 text-xs text-emerald-700">Från arkivet</p>
      ) : value.trim().length > 1 ? (
        <p className="mt-1 text-xs text-slate-500">Nytt namn läggs till i cupen</p>
      ) : null}
      {showSuggestions ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.person_key} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-brand-50 text-brand-700" : "text-slate-800 hover:bg-brand-50/70"
                }`}
              >
                <span className="font-medium">{suggestion.display_name}</span>
                <span className="text-xs text-slate-500">{suggestion.result_count} resultat</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
