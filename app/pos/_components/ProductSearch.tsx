"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProducts, findProducts } from "@/lib/pos/use-products";
import { useCartStore } from "@/lib/pos/cart-store";
import {
  Grid,
  Tag,
  Check,
  Search,
  Barcode,
  Scale,
  Package,
  Cog,
  Settings2,
  Disc,
  Gauge,
  Zap,
  Droplets,
  Filter,
  Car,
  CircleDot,
} from "lucide-react";

// Decorative placeholder for the product image slot — there's no product
// photo anywhere in the schema/catalog yet, so every card rendered with
// nothing but stacked text and no visual anchor at all, which read as
// flat/unfinished next to any catalog that shows a picture (even a
// generic one) per product. Match by category so at least the icon means
// something; anything uncategorized or unmatched falls back to a plain
// box icon.
const CATEGORY_ICONS: Record<string, typeof Package> = {
  "Engine Components": Cog,
  "Gear and Clutch Parts": Settings2,
  "Brake System": Disc,
  "Suspension and Steering": Gauge,
  "Electrical Systems": Zap,
  "Cooling Systems": Droplets,
  "Filters and Lubricants": Filter,
  "Body Parts": Car,
  "Rubber Parts": CircleDot,
};
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
  isNetPriceItem?: boolean;
};

export function ProductSearch({
}: {
  products?: Product[];
}) {
  const [page, setPage] = useState(0);
  const scans = useRef(Promise.resolve());
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
    refocusScanInput();

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

  const lookup = useProducts(searchQuery, selectedCategory, selectedBrand, page);
  const products = lookup.products;
  const loading = lookup.searching;
  const filteredProducts = products;
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    for (const [kind, setter] of [["categories", setCategories], ["brands", setBrands]] as const) {
      fetch('/api/inventory/' + kind, { signal: controller.signal }).then(r => r.json()).then(body => {
        if (body.success) setter(body.data.map((x: string | { name: string }) => typeof x === 'string' ? x : x.name));
      }).catch(() => {});
    }
    return () => controller.abort();
  }, []);
  const filterKey = JSON.stringify([searchQuery, selectedCategory, selectedBrand]);
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) { setPreviousFilterKey(filterKey); setPage(0); }

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
        isNetPriceItem: p.isNetPriceItem,
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

  useEffect(() => {
    const handle = (e: Event) => addOrPromptForWeight((e as CustomEvent<Product>).detail);
    window.addEventListener("pos-add-product", handle);
    return () => window.removeEventListener("pos-add-product", handle);
  }, [addOrPromptForWeight]);

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
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault(); e.stopPropagation();
    const q = e.currentTarget.value.trim();
    if (!q) return;
    setSearchQuery("");
    scans.current = scans.current.then(async () => {
      try {
        const parsed = parseScaleBarcode(q);
        let result = await findProducts(parsed.isScaleBarcode ? parsed.itemCode! : q, { exact: true });
        if (!result.products.length && !parsed.isScaleBarcode) result = await findProducts(q);
        if (result.products.length !== 1) { rejectScan(result.products.length ? 'Multiple matches. Search by exact SKU.' : 'No product matches "' + q + '"'); return; }
        const product = result.products[0];
        if (product.qtyOnHand <= 0) { rejectScan(product.name + ' is out of stock'); return; }
        if (parsed.isScaleBarcode) handleAddItem(product, resolveScaleItemPricing({ unitPrice: product.unitPrice, isWeightBased: product.isScaleItem, parsed }));
        else addOrPromptForWeight(product);
      } catch (error) { rejectScan(error instanceof Error ? error.message : 'Product lookup failed. Retry the scan.'); }
    });
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
            aria-label="Scan barcode or search products"
            id="pos-catalog-search-input"
            placeholder="Scan Barcode or Search Product / SKU... (F1)"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setScanFeedback(null); }}
            onKeyDown={handleSearchKeyDown}
            className={`h-10 w-full rounded-lg border pl-10 pr-4 text-sm font-medium outline-none transition focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 ${
              scanFeedback
                ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20 dark:border-red-800"
                : "border-zinc-200 bg-zinc-50 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/20 dark:border-zinc-700 dark:focus:border-indigo-500"
            }`}
          />
          {scanFeedback && (
            <span role="status" className="block mt-2 text-xs font-bold text-red-600 dark:text-red-400">
              {scanFeedback}
            </span>
          )}
        </div>

        {/* ── Filter Buttons — bold filled blocks, not quiet text pills.
            These are the primary way a cashier narrows the catalog on a
            touchscreen, so they get the same visual weight as the Pay
            button rather than reading as a minor, easy-to-miss filter. */}
        <div className="flex gap-2.5">
          <button
            onClick={() => setActiveFilterTab(activeFilterTab === "category" ? null : "category")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition shadow-sm ${
              activeFilterTab === "category"
                ? "bg-indigo-750 text-white ring-2 ring-indigo-300 dark:ring-indigo-800"
                : "bg-indigo-650 text-white hover:bg-indigo-750"
            }`}
          >
            <Grid className="h-4.5 w-4.5" />
            Category ({categories.length})
          </button>
          <button
            onClick={() => setActiveFilterTab(activeFilterTab === "brand" ? null : "brand")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition shadow-sm ${
              activeFilterTab === "brand"
                ? "bg-indigo-750 text-white ring-2 ring-indigo-300 dark:ring-indigo-800"
                : "bg-indigo-650 text-white hover:bg-indigo-750"
            }`}
          >
            <Tag className="h-4.5 w-4.5" />
            Brands ({brands.length})
          </button>
          {(selectedCategory || selectedBrand) && (
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedBrand(null);
              }}
              className="rounded-xl bg-red-50 text-red-600 px-3.5 py-3 text-sm font-bold hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 transition shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Category Chips ────────────────────────────────────────────────── */}
      {activeFilterTab === "category" && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-bold shrink-0 transition ${
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
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold shrink-0 transition ${
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
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => setSelectedBrand(null)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-bold shrink-0 transition ${
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
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold shrink-0 transition ${
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
      {lookup.error && <p role="alert" className="text-red-700">{lookup.error.message} <button className="underline" onClick={() => void lookup.refetch()}>Retry</button></p>}
      <nav aria-label="Product pages" className="flex items-center justify-between gap-3">
        <button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="rounded border px-3 py-2">Previous</button>
        <span role="status">Page {page + 1}{loading ? ' ? Loading?' : ''}</span>
        <button disabled={!lookup.hasMore || loading} onClick={() => setPage(p => p + 1)} className="rounded border px-3 py-2">Next</button>
      </nav>
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 pb-2">
          {filteredProducts.map((p) => {
            const hasStock = p.qtyOnHand > 0;
            const added = recentlyAdded.has(p.sku);
            const unitSuffix = p.isScaleItem ? "kg" : "pcs";
            const CategoryIcon = (p.category && CATEGORY_ICONS[p.category]) || Package;

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
                {/* Image placeholder — no product photos exist in the
                    catalog yet, but every card still needs a visual
                    anchor instead of just stacked text against white. */}
                <div className="relative mb-2.5 flex h-16 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-zinc-800 dark:to-zinc-800/60">
                  <CategoryIcon className="h-7 w-7 text-indigo-400 dark:text-indigo-500" strokeWidth={1.5} />
                  {added && (
                    <span className="absolute top-1.5 right-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white animate-scale-in">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>

                {/* Name, SKU, badges */}
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <p className="text-[12px] font-mono text-zinc-400">{p.sku}</p>
                    {p.isScaleItem && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        <Scale className="h-2.5 w-2.5" /> Scale
                      </span>
                    )}
                    {p.isReturnable === false && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        Final Sale
                      </span>
                    )}
                    {p.trackSerial && (
                      <span className="rounded px-1 py-0.2 text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        Serial
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom: Price & Stock Tag */}
                <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-sm font-extrabold font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
                    Rs {p.unitPrice.toFixed(2)}{p.isScaleItem ? "/kg" : ""}
                  </span>
                  <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${
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
