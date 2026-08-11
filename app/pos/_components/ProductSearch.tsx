"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/lib/pos/cart-store";
import { Grid, Tag, Image, Coffee, Check, Search } from "lucide-react";

type Product = {
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  unitPrice: number;
  qtyOnHand: number;
};

// ProductSearch — right-side product grid on the POS screen.
// Accepts an optional pre-loaded products array from the parent PosPage so
// the component doesn't need to make its own /api/pos/products fetch when
// the parent has already loaded the same data (eliminates duplicate network
// request: Bug 7 in the audit).
export function ProductSearch({
  products: propProducts,
}: {
  products?: Product[];
}) {
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!propProducts);
  const addItem = useCartStore((s) => s.addItem);

  // Track which SKUs were recently added (for the brief green "added" flash)
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  // Active filter states
  const [activeFilterTab, setActiveFilterTab] = useState<"category" | "brand" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  // Text search query
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter products based on search query + selected chips
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
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
  }, [products, selectedCategory, selectedBrand, searchQuery]);

  // Add item with brief visual confirmation (green flash for 800ms)
  const handleAddItem = useCallback(
    (p: Product) => {
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
      }, 800);
    },
    [addItem]
  );

  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 min-h-0">

      {/* ── Text Search ─────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          placeholder="Search by name, SKU, category or brand…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-base outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-indigo-500 dark:text-zinc-100"
        />
      </div>

      {/* ── Filter Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveFilterTab(activeFilterTab === "category" ? null : "category")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-base font-semibold transition ${
            activeFilterTab === "category"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400"
          }`}
        >
          <Grid className="h-5 w-5" />
          Category
        </button>
        <button
          onClick={() => setActiveFilterTab(activeFilterTab === "brand" ? null : "brand")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-base font-semibold transition ${
            activeFilterTab === "brand"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400"
          }`}
        >
          <Tag className="h-5 w-5" />
          Brands
        </button>
      </div>

      {/* ── Category chips ───────────────────────────────────────────────── */}
      {activeFilterTab === "category" && categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              selectedCategory === null
                ? "bg-indigo-600 text-white"
                : "bg-white text-zinc-650 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(selectedCategory === c ? null : c)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                selectedCategory === c
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-zinc-650 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Brand chips ──────────────────────────────────────────────────── */}
      {activeFilterTab === "brand" && brands.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800">
          <button
            onClick={() => setSelectedBrand(null)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              selectedBrand === null
                ? "bg-indigo-600 text-white"
                : "bg-white text-zinc-650 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
            }`}
          >
            All Brands
          </button>
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrand(selectedBrand === b ? null : b)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                selectedBrand === b
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-zinc-650 hover:bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* ── Product Grid ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        )}
        {!loading && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-zinc-400">
            <Search className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No products found</p>
            <p className="text-xs">Try a different search or filter</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((p) => {
            const hasStock = p.qtyOnHand > 0;
            const added = recentlyAdded.has(p.sku);
            return (
              <button
                key={p.sku}
                onClick={() => handleAddItem(p)}
                disabled={!hasStock}
                aria-label={`Add ${p.name} to cart`}
                className={`group flex flex-col rounded-lg border p-3 text-left transition ${
                  added
                    ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/20"
                    : "border-zinc-200 bg-white hover:border-indigo-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-600"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {/* Visual Thumbnail */}
                <div className={`mb-2.5 flex h-20 sm:h-24 w-full items-center justify-center rounded transition ${
                  added
                    ? "bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                    : "bg-zinc-100 text-zinc-400 group-hover:bg-indigo-50/50 group-hover:text-indigo-500 dark:bg-zinc-800 dark:group-hover:bg-indigo-950/20"
                }`}>
                  {added ? (
                    <Check className="h-8 w-8" />
                  ) : p.sku.includes("Beans") || p.sku.includes("Coffee") || p.name.includes("Espresso") || p.name.includes("Cappuccino") ? (
                    <Coffee className="h-8 w-8" />
                  ) : (
                    <Image className="h-8 w-8" />
                  )}
                </div>

                {/* Name + SKU */}
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2 min-h-[2.4rem]">
                  {p.name}{" "}
                  <span className="text-xs text-zinc-450 dark:text-zinc-500 font-normal">({p.sku})</span>
                </p>

                {/* Price + Stock */}
                <div className="mt-2 flex items-center justify-between border-t border-dashed pt-2 border-zinc-200 dark:border-zinc-800">
                  <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    Rs {p.unitPrice.toFixed(2)}
                  </span>
                  <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                    {hasStock ? `${p.qtyOnHand.toFixed(0)} Pc` : "Out"}
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
