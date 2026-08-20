"use client";

import { useEffect, useRef, useState } from "react";
import { Search, User, X } from "lucide-react";

type CustomerHit = { id: string; name: string; email: string | null; phone: string | null };

/**
 * Real, searchable customer picker — calls the actual /api/customers
 * search endpoint (which already supported `?query=`, filtering by name/
 * email/phone) as you type, instead of the plain native <select> this
 * replaced. That select loaded a flat, one-time list of the first 50
 * customers alphabetically and had zero search capability — at any shop
 * with more than a screenful of customers, finding one meant scrolling a
 * giant native dropdown, and a customer past the 50th alphabetically
 * couldn't be found or selected at all. Search fixes both.
 */
export function CustomerCombobox({
  value,
  displayName,
  onChange,
  placeholder = "Walk-In Customer (Default)",
  id,
}: {
  value: string | null;
  /** Name to show in the input when a customer is selected but the user
   * hasn't typed a new search yet. */
  displayName: string | null;
  onChange: (customer: { id: string; name: string } | null) => void;
  placeholder?: string;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/customers?query=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setResults(res.data);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectCustomer(c: CustomerHit) {
    onChange({ id: c.id, name: c.name });
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function clearSelection() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) selectCustomer(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const shownText = open ? query : query || displayName || "";

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
        {value ? <User className="h-4 w-4 text-indigo-500" /> : <Search className="h-4 w-4" />}
      </div>
      <input
        id={id}
        type="text"
        value={shownText}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-8 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
      />
      {value && !open && (
        <button
          type="button"
          onClick={clearSelection}
          className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600"
          title="Clear (use Walk-In Customer)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            onClick={clearSelection}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800"
          >
            Walk-In Customer (Default)
          </button>
          {loading && <p className="px-3 py-2 text-xs text-zinc-400">Searching…</p>}
          {!loading && results.length === 0 && query.trim() && (
            <p className="px-3 py-2 text-xs text-zinc-400">No customers match &quot;{query}&quot;.</p>
          )}
          {!loading &&
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCustomer(c)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full text-left px-3 py-2 text-xs transition ${
                  i === activeIndex ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="font-bold text-zinc-800 dark:text-zinc-100">{c.name}</span>
                {(c.phone || c.email) && (
                  <span className="ml-1.5 text-zinc-400">{c.phone || c.email}</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
