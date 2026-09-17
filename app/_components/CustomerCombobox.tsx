"use client";
import { useEffect, useId, useRef, useState } from "react";
type CustomerHit = { id: string; name: string; email: string | null; phone: string | null };
export function CustomerCombobox({ value, displayName, onChange, placeholder = "Walk-In Customer", id }: {
  value: string | null; displayName: string | null; onChange: (customer: { id: string; name: string } | null) => void;
  placeholder?: string; id?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setResults([]); setActive(-1);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/customers?query=' + encodeURIComponent(query.trim()), { signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error?.message || "Customer search failed");
        if (!controller.signal.aborted) setResults(body.data);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Search failed. Try again.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, retry]);
  function choose(c: CustomerHit | null) { onChange(c ? { id: c.id, name: c.name } : null); setQuery(""); setOpen(false); setActive(-1); }
  return <div className="relative flex-1" onBlur={(e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setQuery(""); }
  }}>
    <input ref={inputRef} id={id} role="combobox" aria-label="Customer" aria-autocomplete="list"
      aria-expanded={open} aria-controls={listId} aria-activedescendant={open && active >= 0 ? listId + '-' + active : undefined}
      autoComplete="off" value={open ? query : displayName || ""} placeholder={placeholder}
      onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); setQuery(""); }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault(); setOpen(true);
          setActive((i) => Math.max(0, Math.min(results.length, i + (e.key === "ArrowDown" ? 1 : -1))));
        }
        if (e.key === "Enter" && open) { e.preventDefault(); e.stopPropagation(); if (active === 0) choose(null); else if (active > 0 && results[active - 1]) choose(results[active - 1]); }
      }} className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-base font-semibold dark:bg-zinc-900 dark:border-zinc-600" />
    {value && <button type="button" aria-label="Clear customer and use Walk-In" className="absolute right-0 top-0 h-12 w-10" onClick={() => choose(null)}>?</button>}
    {open && <div className="absolute z-30 mt-1 w-full rounded-lg border bg-white shadow-lg dark:bg-zinc-900">
      <div id={listId} role="listbox" aria-label="Customers" className="max-h-64 overflow-y-auto">
        {[null, ...results].map((c, i) => <div key={c?.id ?? 'walk-in'} id={listId + '-' + i} role="option" aria-selected={active === i}
          onMouseDown={(e) => e.preventDefault()} onClick={() => choose(c)} onMouseEnter={() => setActive(i)}
          className={'cursor-pointer px-3 py-3 text-sm ' + (active === i ? 'bg-indigo-100 text-indigo-950 dark:bg-indigo-900 dark:text-white' : '')}>
          <span className="font-semibold">{c?.name ?? 'Walk-In Customer'}</span>{c && <span className="block text-zinc-600 dark:text-zinc-300">{c.phone || c.email}</span>}
        </div>)}
      </div>
      <p role="status" className="px-3 py-2 text-sm">{loading ? 'Searching?' : error || (results.length ? results.length + ' matches' : 'No matching customers')}</p>
      {error && <button type="button" className="px-3 py-2 underline" onClick={() => setRetry((n) => n + 1)}>Retry search</button>}
    </div>}
  </div>;
}
