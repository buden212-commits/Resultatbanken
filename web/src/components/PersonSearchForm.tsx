"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type PersonSuggestion = {
  kind: "person";
  person_key: string;
  display_name: string;
  result_count: number;
};

type EventSuggestion = {
  kind: "event";
  id: number;
  name: string;
  subtitle: string;
};

type Suggestion = PersonSuggestion | EventSuggestion;

type Props = {
  initialQuery?: string;
  variant?: "hero" | "default";
};

function suggestionKey(item: Suggestion): string {
  return item.kind === "person" ? `person-${item.person_key}` : `event-${item.id}`;
}

export function PersonSearchForm({ initialQuery = "", variant = "default" }: Props) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const isHero = variant === "hero";
  const trimmedQuery = query.trim();
  const showSuggestions = isOpen && trimmedQuery.length >= 2 && suggestions.length > 0;
  const people = suggestions.filter((item): item is PersonSuggestion => item.kind === "person");
  const events = suggestions.filter((item): item is EventSuggestion => item.kind === "event");

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    const normalized = searchQuery.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(normalized)}`);
      if (!response.ok) {
        setSuggestions([]);
        return;
      }
      const data = (await response.json()) as {
        people?: Array<{ person_key: string; display_name: string; result_count: number }>;
        events?: Array<{ id: number; name: string; subtitle: string }>;
        results?: Array<{ person_key: string; display_name: string; result_count: number }>;
      };
      const nextPeople = (data.people ?? data.results ?? []).map((person) => ({
        kind: "person" as const,
        ...person,
      }));
      const nextEvents = (data.events ?? []).map((event) => ({
        kind: "event" as const,
        ...event,
      }));
      const next = [...nextPeople, ...nextEvents];
      setSuggestions(next);
      setIsOpen(next.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSuggestions(query);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [query, fetchSuggestions]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function goToSuggestion(item: Suggestion) {
    setIsOpen(false);
    setActiveIndex(-1);
    if (item.kind === "person") {
      router.push(`/person/${encodeURIComponent(item.person_key)}`);
      return;
    }
    router.push(`/resultat/${item.id}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = trimmedQuery;
    if (!normalized) {
      return;
    }

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goToSuggestion(suggestions[activeIndex]);
      return;
    }

    setIsOpen(false);
    router.push(`/sok?q=${encodeURIComponent(normalized)}`);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (index < suggestions.length - 1 ? index + 1 : 0));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => (index > 0 ? index - 1 : suggestions.length - 1));
        break;
      case "Enter":
        if (activeIndex >= 0) {
          event.preventDefault();
          goToSuggestion(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      case "Tab":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  const activeDescendant =
    activeIndex >= 0 && suggestions[activeIndex]
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  function optionClass(index: number) {
    return `flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
      index === activeIndex ? "bg-brand-50 text-brand-700" : "text-slate-800 hover:bg-brand-50/70"
    }`;
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`relative flex gap-2 ${isHero ? "flex-row" : "flex-col sm:flex-row"} ${showSuggestions ? "z-30" : ""}`}
      role="search"
    >
      <div ref={containerRef} className="relative z-30 flex-1">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
          />
        </svg>
        <input
          type="search"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (trimmedQuery.length >= 2 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Namn, tävling, plats eller år"
          aria-label="Sök namn, tävling, plats eller år"
          className={`input-field input-field-with-icon ${isHero ? "h-12 text-base shadow-lg shadow-black/5" : ""}`}
        />
        {showSuggestions ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Förslag"
            className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-50 max-h-[22rem] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            {people.length > 0 ? (
              <li className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Personer
              </li>
            ) : null}
            {people.map((suggestion) => {
              const index = suggestions.indexOf(suggestion);
              return (
                <li
                  key={suggestionKey(suggestion)}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => goToSuggestion(suggestion)}
                    className={optionClass(index)}
                  >
                    <span className="truncate font-medium">{suggestion.display_name}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {suggestion.result_count} resultat
                    </span>
                  </button>
                </li>
              );
            })}
            {events.length > 0 ? (
              <li className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tävlingar
              </li>
            ) : null}
            {events.map((suggestion) => {
              const index = suggestions.indexOf(suggestion);
              return (
                <li
                  key={suggestionKey(suggestion)}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => goToSuggestion(suggestion)}
                    className={optionClass(index)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{suggestion.name}</span>
                      {suggestion.subtitle ? (
                        <span className="block truncate text-xs font-normal text-slate-500">
                          {suggestion.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {isLoading && trimmedQuery.length >= 2 && !showSuggestions ? (
          <span className="sr-only" aria-live="polite">
            Laddar förslag
          </span>
        ) : null}
      </div>
      <button type="submit" className={`btn-primary shrink-0 ${isHero ? "h-12 px-4 sm:px-6" : ""}`}>
        Sök
      </button>
    </form>
  );
}
