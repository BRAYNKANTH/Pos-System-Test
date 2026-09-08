"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useCartStore } from "@/lib/pos/cart-store";
import { Grid, Tag, Check, Search, Barcode, Scale } from "lucide-react";
import { parseScaleBarcode, resolveScaleItemPricing, resolveManualWeightPricing } from "@/lib/pos/scale-barcode";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Product = {
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  unitPrice: number;
  purchasePrice?: number;
  qtyOnHand: number;
  isScaleItem?: boolean;
  isReturnable?: boolean;
  trackSerial?: boolean;
  trackBatch?: boolean;
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

  // A barcode scanner is just a keyboard emulator — it only ever reaches
  // whatever currently has focus, so this box has to actively hold onto
  // it. Auto-focus on mount, and refocus after anything that could have
  // moved focus away (an add completing, a scan not matching, a modal
  // closing) — see refocusScanInput and its call sites below.
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  function refocusScanInput() {
    // Deferred a tick — called right after state changes that re-render
    // (closing a modal, clearing the query), so the input still exists
    // and isn't about to be re-blurred by that same render pass.
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  // Track which SKUs were recently added
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  // Feedback for a scan that didn't match anything, or matched something
  // out of stock — previously this left the raw barcode digits sitting in
  // the box with zero feedback, and the *next* scan would just get
  // appended onto that leftover text instead of starting clean.
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  function rejectScan(message: string) {
    setScanFeedback(message);
    setSearchQuery("");
    refocusScanInput();
    setTimeout(() => setScanFeedback(null), 2000);
  }

  // Manual weight entry — for a scale item added by clicking its catalog
  // card instead of scanning a scale barcode (no scanner attached, or the
  // label is damaged). Without this there was no way to correctly sell a
  // weighed item except by scanning; a plain click added it with no
  // weight, and calculateCart would have priced it as a full 1kg away
  // from what the customer actually bought.
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);
  const [manualWeightInput, setManualWeightInput] = useState("");

  // Active filter states
  const [activeFilterTab, setActiveFilterTab] = useState<"category" | "brand" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  // Text search query with deferred value for 60fps filtering
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (propProducts) {
      // No fetch needed when products arrive via props — turning the
      // loading flag off immediately, not state derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    (p: Product, scaleOpts?: { scaleWeight?: number; unitPrice?: number; displayRatePerKg?: number }) => {
      if (p.qtyOnHand <= 0) return;
      addItem({
        sku: p.sku,
        name: p.name,
        unitPrice: scaleOpts?.unitPrice ?? p.unitPrice,
        purchasePrice: p.purchasePrice,
        scaleWeight: scaleOpts?.scaleWeight,
        displayRatePerKg: scaleOpts?.displayRatePerKg,
        isScaleItem: p.isScaleItem,
        isReturnable: p.isReturnable,
        trackSerial: p.trackSerial,
        trackBatch: p.trackBatch,
      });
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
      // A mouse click on a product card moves focus to that button, not
      // back to the scan box — the next scan needs it back there.
      refocusScanInput();
    },
    [addItem]
  );

  // Any add of a scale item that didn't come from a scanned scale barcode
  // (typed SKU, single-result search match, or a plain catalog-card
  // click) needs a weight from somewhere — prompt for it instead of
  // silently adding with none, which used to price it as if it weighed
  // exactly 1kg regardless of what was actually being sold.
  const addOrPromptForWeight = useCallback(
    (p: Product) => {
      if (p.isScaleItem) {
        setWeighingProduct(p);
        setManualWeightInput("");
        return;
      }
      handleAddItem(p);
    },
    [handleAddItem, setManualWeightInput, setWeighingProduct]
  );

  function confirmManualWeight() {
    if (!weighingProduct) return;
    const weight = Number(manualWeightInput);
    if (!Number.isFinite(weight) || weight <= 0) return;
    const pricing = resolveManualWeightPricing({ unitPrice: weighingProduct.unitPrice, weightKg: weight });
    handleAddItem(weighingProduct, pricing);
    setWeighingProduct(null);
    setManualWeightInput("");
  }

  function cancelManualWeight() {
    setWeighingProduct(null);
    refocusScanInput();
  }

  // Barcode / Fast-scan Enter Handler (with Scale Barcode Parser)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;

      // 1. Check for variable weight / scale barcode (EAN-13 / UPC-A format)
      const parsedScale = parseScaleBarcode(q);
      if (parsedScale.isScaleBarcode && parsedScale.itemCode) {
        const scaleMatch = products.find(
          (p) =>
            p.sku.toLowerCase() === parsedScale.itemCode?.toLowerCase() ||
            p.sku.toLowerCase().endsWith(parsedScale.itemCode?.toLowerCase() ?? "") ||
            p.sku.toLowerCase().includes(parsedScale.itemCode?.toLowerCase() ?? "")
        );
        if (scaleMatch) {
          if (scaleMatch.qtyOnHand <= 0) {
            rejectScan(`${scaleMatch.name} is out of stock`);
            return;
          }
          const pricing = resolveScaleItemPricing({
            unitPrice: scaleMatch.unitPrice,
            isWeightBased: scaleMatch.isScaleItem,
            parsed: parsedScale,
          });
          handleAddItem(scaleMatch, {
            unitPrice: pricing.unitPrice,
            scaleWeight: pricing.scaleWeight,
            displayRatePerKg: pricing.displayRatePerKg,
          });
          setSearchQuery("");
          return;
        }
        // A recognized scale-barcode format with no matching product is
        // still a definite failure — don't fall through to a fuzzy
        // substring match against the raw scale barcode digits.
        rejectScan("Scale barcode not recognized — no matching product");
        return;
      }

      const qLower = q.toLowerCase();
      // 2. Check exact SKU or name match
      const exactMatch = products.find(
        (p) => p.sku.toLowerCase() === qLower || p.name.toLowerCase() === qLower
      );

      if (exactMatch) {
        if (exactMatch.qtyOnHand <= 0) {
          rejectScan(`${exactMatch.name} is out of stock`);
          return;
        }
        addOrPromptForWeight(exactMatch);
        setSearchQuery("");
      } else if (filteredProducts.length === 1) {
        if (filteredProducts[0].qtyOnHand <= 0) {
          rejectScan(`${filteredProducts[0].name} is out of stock`);
          return;
        }
        addOrPromptForWeight(filteredProducts[0]);
        setSearchQuery("");
      } else if (filteredProducts.length === 0) {
        rejectScan(`No product matches "${q}"`);
      }
      // filteredProducts.length > 1: ambiguous text search — leave the
      // query in place so the cashier can keep narrowing it, or pick
      // straight from the filtered grid below.
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 min-h-0">

      {/* ── Search & Filter Controls ──────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Barcode className={`pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ${scanFeedback ? "text-red-500" : "text-indigo-500"}`} />
          <input
            ref={searchInputRef}
            type="search"
            id="pos-catalog-search-input"
            placeholder="Scan Barcode or Search Product / SKU... (F1)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className={`h-10 w-full rounded-lg border pl-10 pr-4 text-sm font-medium outline-none transition focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 ${
              scanFeedback
                ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800"
                : "border-zinc-200 bg-zinc-50 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/20 dark:border-zinc-700 dark:focus:border-indigo-500"
            }`}
          />
          {scanFeedback && (
            <span className="absolute left-10 right-3 top-1/2 -translate-y-1/2 truncate text-xs font-bold text-red-600 dark:text-red-400 pointer-events-none bg-red-50 dark:bg-zinc-900">
              {scanFeedback}
            </span>
          )}
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
            const unitSuffix = p.isScaleItem ? "kg" : "pcs";

            return (
              <button
                key={p.sku}
                onClick={() => addOrPromptForWeight(p)}
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[10px] font-mono text-zinc-400">{p.sku}</p>
                    {p.isScaleItem && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        <Scale className="h-2.5 w-2.5" /> Scale
                      </span>
                    )}
                    {p.isReturnable === false && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        Final Sale
                      </span>
                    )}
                    {p.trackSerial && (
                      <span className="rounded px-1 py-0.2 text-[9px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        Serial
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom: Price & Stock Tag */}
                <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-extrabold font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
                    Rs {p.unitPrice.toFixed(2)}{p.isScaleItem ? "/kg" : ""}
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

      {/* Manual Weight Entry — scale item added by card click / typed SKU
          instead of a scanned scale barcode */}
      <Modal open={!!weighingProduct} onClose={cancelManualWeight} title="Enter Weight">
        {weighingProduct && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{weighingProduct.name}</p>
              <p className="text-xs text-zinc-500">Rs {weighingProduct.unitPrice.toFixed(2)} / kg</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Weight (kg)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                autoFocus
                value={manualWeightInput}
                onChange={(e) => setManualWeightInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmManualWeight();
                  }
                }}
                placeholder="0.000"
                className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-lg font-bold font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800"
              />
              {Number(manualWeightInput) > 0 && (
                <p className="text-xs font-bold text-emerald-600">
                  = Rs {(Number(manualWeightInput) * weighingProduct.unitPrice).toFixed(2)}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelManualWeight}>Cancel</Button>
              <Button
                onClick={confirmManualWeight}
                disabled={!(Number(manualWeightInput) > 0)}
                className="bg-indigo-650 hover:bg-indigo-750 text-white"
              >
                Add to Cart
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
