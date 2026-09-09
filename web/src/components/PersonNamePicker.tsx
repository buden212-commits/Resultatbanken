"use client";

import { KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

type MenuRect = {
  top: number;
  left: number;
  width: number;
};

export function PersonNamePicker({ value, personKey, onChange }: Props) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);

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

  function updateMenuPosition() {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const rect = input.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 256),
    });
  }

  useLayoutEffect(() => {
    if (!showSuggestions) {
      setMenuRect(null);
      return;
    }
    updateMenuPosition();
    function onScrollOrResize() {
      updateMenuPosition();
    }
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showSuggestions, value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
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

  const suggestionList =
    showSuggestions && menuRect && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width }}
            className="fixed z-[70] max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
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
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
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
      ) : value.trim().length > 1 && !showSuggestions ? (
        <p className="mt-1 text-xs text-slate-500">Nytt namn läggs till i cupen</p>
      ) : null}
      {suggestionList}
    </div>
  );
}
