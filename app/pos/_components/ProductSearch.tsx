"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "@/lib/pos/cart-store";
import { Grid, Tag, Image, Check, Search, Barcode, Sparkles } from "lucide-react";

type Product = {
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  unitPrice: number;
  qtyOnHand: number;
};

export function ProductSearch({
  products: propProducts,
}: {
  products?: Product[];
}) {
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!propProducts);
  const addItem = useCartStore((s) => s.addItem);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track which SKUs were recently added
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  // Active filter states
  const [activeFilterTab, setActiveFilterTab] = useState<"category" | "brand" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  // Text search query with deferred value for 60fps filtering
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (propProducts) {
      setLoading(false);
      return;
    }
    fetch("/api/pos/products")
      .then((r) => r.json())
      .then((body) => {
        if (body.success) setLocalProducts(body.data);
      })
      .finally(() => setLoading(false));
  }, [propProducts]);

  const products = propProducts ?? localProducts;

  // Compute unique categories and brands
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort(),
    [products]
  );

  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter((b): b is string => !!b))].sort(),
    [products]
  );

  // Filter products based on deferred search query + selected chips
  const filteredProducts = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (selectedBrand && p.brand !== selectedBrand) return false;
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.category?.toLowerCase() ?? "").includes(q) ||
          (p.brand?.toLowerCase() ?? "").includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategory, selectedBrand, deferredQuery]);

  // Add item with brief visual confirmation (green flash for 500ms)
  const handleAddItem = useCallback(
    (p: Product) => {
      if (p.qtyOnHand <= 0) return;
      addItem(p);
      setRecentlyAdded((prev) => {
        const next = new Set(prev);
        next.add(p.sku);
        return next;
      });
      setTimeout(() => {
        setRecentlyAdded((prev) => {
          const next = new Set(prev);
          next.delete(p.sku);
          return next;
        });
      }, 500);
    },
    [addItem]
  );

  // Barcode / Fast-scan Enter Handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      // Check exact SKU or barcode match first
      const exactMatch = products.find(
        (p) => p.sku.toLowerCase() === q || p.name.toLowerCase() === q
      );

      if (exactMatch && exactMatch.qtyOnHand > 0) {
        handleAddItem(exactMatch);
        setSearchQuery("");
      } else if (filteredProducts.length === 1 && filteredProducts[0].qtyOnHand > 0) {
        handleAddItem(filteredProducts[0]);
        setSearchQuery("");
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 min-h-0">

      {/* ── Search & Filter Controls ──────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Barcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-500" />
          <input
            ref={searchInputRef}
            type="search"
            id="pos-catalog-search-input"
            placeholder="Scan Barcode or Search Product / SKU... (F1)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-indigo-500 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        {/* ── Filter Buttons ──────────────────────────────────────────────── */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveFilterTab(activeFilterTab === "category" ? null : "category")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-bold transition shadow-2xs ${
              activeFilterTab === "category"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveFilterTab(activeFilterTab === "brand" ? null : "brand")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-bold transition shadow-2xs ${
              activeFilterTab === "brand"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            Brands ({brands.length})
          </button>
          {(selectedCategory || selectedBrand) && (
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedBrand(null);
              }}
              className="rounded-lg bg-red-50 text-red-600 px-2.5 py-1 text-xs font-bold hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Category Chips ────────────────────────────────────────────────── */}
      {activeFilterTab === "category" && categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`rounded-md px-2.5 py-1 text-xs font-bold shrink-0 transition ${
              selectedCategory === null
                ? "bg-indigo-600 text-white"
                : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(selectedCategory === c ? null : c)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold shrink-0 transition ${
                selectedCategory === c
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Brand Chips ───────────────────────────────────────────────────── */}
      {activeFilterTab === "brand" && brands.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => setSelectedBrand(null)}
            className={`rounded-md px-2.5 py-1 text-xs font-bold shrink-0 transition ${
              selectedBrand === null
                ? "bg-indigo-600 text-white"
                : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
            }`}
          >
            All
          </button>
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrand(selectedBrand === b ? null : b)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold shrink-0 transition ${
                selectedBrand === b
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* ── Product Catalog Grid (Scroll Area) ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin min-h-0">
        {loading && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-850" />
            ))}
          </div>
        )}
        {!loading && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-400">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm font-semibold">No matching products</p>
            <p className="text-xs text-zinc-400">Try searching a different SKU or clearing active filters</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 pb-2">
          {filteredProducts.map((p) => {
            const hasStock = p.qtyOnHand > 0;
            const added = recentlyAdded.has(p.sku);
            const isWeighed = p.sku.toLowerCase().includes("kowpi") || (p.category && p.category.toLowerCase().includes("dairy")) || p.name.toLowerCase().includes("powder");
            const unitSuffix = isWeighed ? "kg" : "pcs";

            return (
              <button
                key={p.sku}
                onClick={() => handleAddItem(p)}
                disabled={!hasStock}
                aria-label={`Add ${p.name} to cart`}
                className={`group relative flex flex-col justify-between text-left rounded-xl border p-3 transition-all duration-150 ${
                  added
                    ? "border-emerald-500 bg-emerald-50/80 shadow-md ring-2 ring-emerald-400/40 dark:bg-emerald-950/30"
                    : "border-zinc-200 bg-white hover:border-indigo-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500"
                } disabled:cursor-not-allowed disabled:opacity-40 select-none`}
              >
                {/* Top: Name and Stock Indicator */}
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                      {p.name}
                    </p>
                    {added && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white animate-scale-in">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-zinc-400">{p.sku}</p>
                </div>

                {/* Bottom: Price & Stock Tag */}
                <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-extrabold font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
                    Rs {p.unitPrice.toFixed(2)}
                  </span>
                  <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                    hasStock
                      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      : "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                  }`}>
                    {hasStock ? `${p.qtyOnHand.toFixed(0)} ${unitSuffix}` : "Out"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
