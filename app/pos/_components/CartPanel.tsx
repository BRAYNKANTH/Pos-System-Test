"use client";

import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useCartStore, type CartLine } from "@/lib/pos/cart-store";
import { calculateCart, applyDiscount, applyLineOverridesAndDiscounts, type CartCalculation } from "@/lib/pos/pricing";
import { Modal } from "@/components/ui/modal";
import { useProducts } from "@/lib/pos/use-products";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { CustomerCombobox } from "@/app/_components/CustomerCombobox";
import { ManagerPinModal } from "@/app/_components/ManagerPinModal";
import {
  Plus,
  Search,
  X,
  Minus,
  Percent,
  TrendingUp,
  Truck,
  Edit,
  UserPlus,
  Tag,
  ShieldAlert,
  RotateCcw,
  SlidersHorizontal,
  ScanBarcode,
} from "lucide-react";

type Product = {
  sku: string;
  name: string;
  unitPrice: number;
  qtyOnHand: number;
};

export function CartPanel({
  calculation,
  taxRate = 8,
}: {
  products?: Product[];
  calculation?: CartCalculation;
  taxRate?: number;
}) {
  const {
    lines,
    discount,
    loyaltyRedeem,
    shipping,
    customerId,
    customerName,
    addItem,
    removeItem,
    setQty,
    setLineBatch,
    setLinePriceOverride,
    setLineDiscount,
    setLineDescription,
    setLineLotExpiry,
    setLineUnit,
    setDiscount,
    applyLoyaltyRedeem,
    clearLoyaltyRedeem,
    setShipping,
    setCustomer,
  } = useCartStore();

  const [productQuery, setProductQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Which line's quick-edit popup is open (line id — NOT sku, since two
  // lines can share a sku for scale/serial items). Was an inline
  // expand-row accordion; replaced with a click-the-name popup (matching
  // the reference POS's pattern) so the row itself stays clean instead of
  // carrying a chevron/expand affordance.
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  // Undo delete tracking
  const [lastDeletedItem, setLastDeletedItem] = useState<{ item: CartLine; index: number } | null>(null);

  // Inline Discount & Shipping edit toggles
  const [editingDiscountInline, setEditingDiscountInline] = useState(false);
  const [editingShippingInline, setEditingShippingInline] = useState(false);
  const [discountVal, setDiscountVal] = useState(discount?.value || 0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">(discount?.type || "percent");
  const [shippingVal, setShippingVal] = useState(shipping || 0);

  // Customer quick-create modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  // Closing this modal leaves focus nowhere in particular — the next
  // barcode scan (keyboard-emulated) needs the catalog scan box focused
  // to go anywhere at all.
  useEffect(() => {
    if (!isCustomerModalOpen) {
      const t = setTimeout(() => document.getElementById("pos-catalog-search-input")?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isCustomerModalOpen]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [canOverridePrice, setCanOverridePrice] = useState(false);

  // Lets a manager unlock price override for one line by scanning their
  // access card (or typing their PIN) in front of the cashier, instead
  // of the cashier needing PRICE_OVERRIDE on their own account — the
  // "manager scans a card to approve" pattern. Scoped to a single line's
  // edit session (cleared whenever a different line is opened, see the
  // Modal's onClose below) rather than a standing unlock, so each
  // override still needs its own in-person approval.
  const [priceOverrideUnlock, setPriceOverrideUnlock] = useState<{ lineId: string; approverName: string } | null>(null);
  const [managerPinModalOpen, setManagerPinModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/pos/permissions")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCanOverridePrice(Boolean(res.data.priceOverride));
      }).catch(() => setCanOverridePrice(false));
  }, []);

  const [customerLoyalty, setCustomerLoyalty] = useState<{
    loyaltyPoints: number;
    loyaltyTier: string;
    maxDiscountValue: number;
  } | null>(null);


  useEffect(() => {
    if (!customerId) {
      // Clearing stale loyalty data for the previous customer the instant
      // the selection changes/clears — synchronizing to an external prop
      // change, not state that could be derived during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomerLoyalty(null);
      return;
    }
    const controller = new AbortController();
    setCustomerLoyalty(null);
    fetch(`/api/customers/loyalty?customerId=${customerId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setCustomerLoyalty(res.data);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [customerId]);


  // Filter products for the inline search bar
  const productLookup = useProducts(productQuery);
  const filteredProducts = productQuery.trim() ? productLookup.products : [];

  const localCalculation = useMemo(() => {
    if (calculation) return calculation;
    if (lines.length === 0) {
      return { lines: [], subtotal: 0, totalDiscount: 0, tax: 0, total: 0 };
    }
    let cartLines = applyLineOverridesAndDiscounts(lines);
    if (discount) {
      cartLines = applyDiscount(cartLines, {
        scope: "cart",
        type: discount.type,
        value: discount.value,
      });
    }
    return calculateCart(cartLines, taxRate / 100, shipping);
  }, [calculation, lines, discount, taxRate, shipping]);

  const calc = localCalculation;
  const editingLine = lines.find((l) => l.id === editingLineId) ?? null;

  // Batches available for the line currently open in the quick-edit popup
  // — same SKU can have several batches (different cost, possibly
  // different selling price) sharing one barcode, and the cashier needs
  // to see and pick which one they're actually selling from rather than
  // blindly typing a batch number with no idea what's in stock or what it
  // costs. Keyed off primitive fields, not the `editingLine` object
  // itself (a fresh object every render from .find()), so this only
  // re-fetches when the line being edited — or its sku — actually changes.
  const batchQuery = useQuery({
    queryKey: ['item-batches', editingLine?.sku], enabled: !!editingLine?.trackBatch,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/inventory/' + encodeURIComponent(editingLine!.sku) + '/batches', { signal });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Could not load batches');
      return body.data as { batchNumber: string; qtyOnHand: number; expiryDate: string | null; unitPrice: number | null }[];
    },
  });
  const availableBatches = batchQuery.data ?? [];
  const batchesLoading = batchQuery.isFetching;

  // Picking a batch sets both its number (so checkout deducts from that
  // exact lot, not FIFO-guessed) and its price — a batch's own price is
  // the correct price for units from that lot, not a cashier's
  // discretionary call, so this applies regardless of canOverridePrice
  // (which only gates the free-typed manual price field below). A batch
  // with no price of its own (unitPrice: null) explicitly clears any
  // previous batch-driven override back to the catalog price.
  function selectBatch(
    lineId: string,
    catalogPrice: number,
    batch: { batchNumber: string; unitPrice: number | null },
  ) {
    setLineBatch(lineId, batch.batchNumber);
    useCartStore.setState((s) => ({ lines: s.lines.map((l) => l.id === lineId ? {
      ...l, catalogUnitPrice: l.catalogUnitPrice ?? catalogPrice,
      unitPrice: batch.unitPrice ?? l.catalogUnitPrice ?? catalogPrice, priceOverride: null,
    } : l) }));
  }

  // Remove line with undo support
  function handleRemoveItemWithUndo(line: CartLine, index: number) {
    setLastDeletedItem({ item: line, index });
    removeItem(line.id);
    setTimeout(() => {
      setLastDeletedItem((prev) => (prev?.item.id === line.id ? null : prev));
    }, 6000);
  }

  function handleUndoDelete() {
    if (!lastDeletedItem) return;
    // Pass the original qty through explicitly — addItem defaults new
    // lines to qty 1, which would otherwise silently shrink a qty>1 line
    // back down to 1 on undo.
    addItem(lastDeletedItem.item, lastDeletedItem.item.qty);
    setLastDeletedItem(null);
  }

  // Create new customer
  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomerName || savingCustomer) return;

    setCustomerError(null);
    setSavingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName,
          email: newCustomerEmail || undefined,
          phone: newCustomerPhone || undefined,
        }),
      });
      const body = await res.json();
      if (body.success) {
        setCustomer({ id: body.data.id, name: body.data.name });
        setNewCustomerName("");
        setNewCustomerEmail("");
        setNewCustomerPhone("");
        setIsCustomerModalOpen(false);
      }
      else setCustomerError(body.error?.message ?? "Could not add customer.");
    } catch {
      setCustomerError("Could not connect. Check your connection and try again.");
    } finally {
      setSavingCustomer(false);
    }
  }

  // Save inline discount
  function applyInlineDiscount() {
    if (discountVal > 0) {
      setDiscount({ type: discountType, value: Number(discountVal) });
    } else {
      setDiscount(null);
    }
    setEditingDiscountInline(false);
  }

  // Save inline shipping
  function applyInlineShipping() {
    setShipping(Number(shippingVal) || 0);
    setEditingShippingInline(false);
  }

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 min-h-0">

      {/* ── Top Bar: Customer Selector + Add Customer + Product Search ──────
          One row, not two — the reference layout keeps customer select
          compact off to the side and gives the product search the bulk of
          the row's width, since scanning/searching for the next item is
          the action a cashier repeats constantly, while switching the
          customer is comparatively rare. Was stacked as two full-width
          rows, which buried search as a secondary-looking element below a
          full-width customer selector it doesn't need to compete with. */}
      <div className="mb-3 flex items-center gap-2">
        {/* 38% is comfortable once the row has real width (tablet/desktop);
            on a narrow phone that share leaves too little room to read the
            selected customer's name, so it gets half the row below sm. */}
        <div className="flex w-1/2 sm:w-[38%] shrink-0 items-center gap-1.5">
          <CustomerCombobox
            id="pos-customer-select"
            value={customerId || null}
            displayName={customerName ?? null}
            onChange={(c) => setCustomer(c)}
          />
          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 transition"
            title="Add New Customer"
          >
            <UserPlus className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Scan SKU / Barcode / Search..."
            value={productQuery}
            onChange={(e) => {
              setProductQuery(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            // No text-* color class here means typed text just inherits the
            // ambient (dark) body color — fine for real input, but the
            // placeholder is styled through the separate ::placeholder
            // pseudo-element and was defaulting to the browser's own light
            // gray without an explicit placeholder: override, same root
            // cause as the customer field right next to it.
            className="h-12 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-11 pr-9 text-lg font-medium outline-none focus:border-indigo-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-zinc-600 dark:placeholder:text-zinc-400"
          />
          {productQuery && (
            <button
              onClick={() => {
                setProductQuery("");
                setShowProductDropdown(false);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <span role="status" className="sr-only">{productLookup.searching ? "Searching products" : productLookup.error?.message}</span>
        {/* Dropdown Results */}
          {showProductDropdown && filteredProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-[52px] z-30 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              {filteredProducts.map((p) => (
                <button
                  key={p.sku}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("pos-add-product", { detail: p }));
                    setProductQuery("");
                    setShowProductDropdown(false);
                  }}
                  disabled={p.qtyOnHand <= 0}
                  className="flex w-full items-center justify-between px-3.5 py-3 text-left text-base hover:bg-indigo-50/60 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
                >
                  <div>
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">{p.name}</p>
                    <p className="text-sm font-mono text-zinc-500 dark:text-zinc-400">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Rs {p.unitPrice.toFixed(2)}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{p.qtyOnHand} in stock</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer Loyalty Tier & Points Badge */}
      {customerLoyalty && (
        <div className="mb-3 flex items-center justify-between p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs dark:bg-indigo-950/30 dark:border-indigo-900/40">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-300">
            <span className="px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800 text-[12px] font-extrabold uppercase dark:bg-indigo-900 dark:text-indigo-200">
              🏆 {customerLoyalty.loyaltyTier} Member
            </span>
            <span>{customerLoyalty.loyaltyPoints} Pts (Rs {customerLoyalty.maxDiscountValue.toFixed(2)})</span>
          </div>

          {loyaltyRedeem ? (
            <button
              onClick={clearLoyaltyRedeem}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-red-600 text-white font-extrabold text-[12px] transition shadow-2xs"
              title="Click to remove the applied loyalty discount"
            >
              Applied ({loyaltyRedeem.points} pts) ✕
            </button>
          ) : (
            customerLoyalty.maxDiscountValue > 0 && (
              <button
                onClick={() => {
                  applyLoyaltyRedeem(customerLoyalty.loyaltyPoints, customerLoyalty.maxDiscountValue);
                }}
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[12px] transition shadow-2xs"
              >
                Apply Loyalty Disc
              </button>
            )
          )}
        </div>
      )}

      {/* ── Undo Toast Notification ────────────────────────────────────────── */}
      {lastDeletedItem && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-zinc-900 text-white px-3 py-1.5 text-xs animate-slide-up shadow-md">
          <span className="truncate max-w-[200px]">Removed {lastDeletedItem.item.name}</span>
          <button
            onClick={handleUndoDelete}
            className="flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 underline ml-2 shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            Undo
          </button>
        </div>
      )}

      {/* ── Cart Items Table ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-lg mb-3 dark:border-zinc-800 scrollbar-thin min-h-[160px]">
        <table className="w-full text-base table-fixed">
          <thead className="bg-zinc-50 sticky top-0 text-left font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 z-10 select-none text-sm">
            <tr>
              <th className="px-3 py-2.5 w-[46%]">Item</th>
              <th className="px-1 py-2.5 text-center w-[26%]">Qty</th>
              <th className="px-2 py-2.5 text-right w-[20%]">Total</th>
              <th className="px-1 py-2.5 text-center w-[8%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-zinc-400">
                  <p className="text-sm font-semibold">Cart is currently empty</p>
                  <p className="text-xs text-zinc-400 mt-1">Scan an item or select from the product catalog</p>
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => {
                // Positional, not sku-matched — calc.lines is produced by
                // mapping over `lines` 1:1 (same order/count), and two
                // lines can share a sku (scale/serial items), so matching
                // by sku would always resolve to whichever of them came
                // first.
                const lineCalc = calc.lines[idx];
                const sub = lineCalc ? lineCalc.lineSubtotal : line.qty * line.unitPrice;
                const isLockedQty = line.isScaleItem || line.trackSerial;

                return (
                  <React.Fragment key={line.id}>
                    <tr className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition">
                      {/* Product Name & SKU — the name itself is the
                          affordance for the quick-edit popup (price
                          override, discount, batch/serial), styled as a
                          link so it reads as clickable at a glance
                          instead of needing a separate chevron button. */}
                      <td className="px-3 py-2.5">
                        <div className="truncate">
                          <button
                            onClick={() => setEditingLineId(line.id)}
                            className="font-extrabold text-indigo-650 hover:text-indigo-750 hover:underline truncate flex items-center gap-1.5 text-left"
                            title="Edit price, discount, batch, or serial"
                          >
                            {line.name}
                            {line.isReturnable === false && (
                              <span className="rounded bg-amber-100 text-amber-800 text-[12px] px-1 py-0.2 font-bold dark:bg-amber-950/60 dark:text-amber-300">
                                Final Sale
                              </span>
                            )}
                          </button>
                          <p className="text-[12px] font-mono text-zinc-400 tabular-nums flex items-center gap-1 flex-wrap">
                            {line.scaleWeight ? (
                              <span className="text-blue-600 dark:text-blue-400 font-bold">
                                {line.scaleWeight.toFixed(3)} kg @ Rs {(line.displayRatePerKg ?? line.unitPrice).toFixed(2)}/kg
                              </span>
                            ) : line.priceOverride ? (
                              <>
                                <span className="line-through mr-1">Rs {line.unitPrice.toFixed(2)}</span>
                                <span className="text-amber-600 font-bold">Rs {line.priceOverride.newPrice.toFixed(2)}</span>
                              </>
                            ) : (
                              `Rs ${line.unitPrice.toFixed(2)}`
                            )}
                            {line.lineDiscount && (
                              <span className="ml-1 text-emerald-600 font-semibold">
                                (-{line.lineDiscount.value}{line.lineDiscount.type === "percent" ? "%" : "Rs"})
                              </span>
                            )}
                            {lineCalc?.marginClamped && (
                              <span className="ml-1 text-amber-600 font-bold" title="Discount capped at cost price">
                                (Cost Floor Protected)
                              </span>
                            )}
                          </p>
                        </div>
                      </td>

                      {/* Quantity Stepper — locked at 1 for scale/serial
                          lines: each unit is its own line (own weight,
                          own serial), so "quantity" here is never
                          meaningful to bump; scan/add again for another
                          unit instead. */}
                      <td className="px-1 py-2.5 text-center">
                        {isLockedQty ? (
                          <span
                            className="text-[12px] font-bold text-zinc-400 uppercase"
                            title={line.isScaleItem ? "Weighed item — scan/add again for another" : "Serialized item — add again for another unit"}
                          >
                            1 {line.isScaleItem ? "wt" : "unit"}
                          </span>
                        ) : (
                          <div className="inline-flex items-center border border-zinc-200 rounded-md bg-white dark:border-zinc-700 dark:bg-zinc-900 shadow-2xs">
                            <button
                              aria-label={`Decrease quantity for ${line.name}`}
                              disabled={line.qty <= 1}
                              onClick={() => setQty(line.id, line.qty - 1)}
                              className="h-8 w-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l transition"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <NumberInput
                              aria-label={`Quantity for ${line.name}`}
                              min={1}
                              integer
                              value={line.qty}
                              onValueChange={(qty) => setQty(line.id, qty)}
                              className="h-8 w-12 text-center text-base font-bold font-mono outline-none focus:ring-1 focus:ring-indigo-500 rounded dark:bg-zinc-900 text-zinc-900 dark:text-white tabular-nums"
                            />
                            <button
                              aria-label={`Increase quantity for ${line.name}`}
                              onClick={() => setQty(line.id, line.qty + 1)}
                              className="h-8 w-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r transition"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Subtotal */}
                      <td className="px-2 py-2.5 text-right font-mono font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        Rs {sub.toFixed(2)}
                      </td>

                      {/* Delete */}
                      <td className="px-1 py-2.5 text-center">
                        <button
                          onClick={() => handleRemoveItemWithUndo(line, idx)}
                          className="h-7 w-7 flex items-center justify-center rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                          title="Remove item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Cart Totals Summary (Inline Editable Controls) ─────────────────── */}
      <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800 select-none">

        {/* Row 1: Subtotal, Items count, Grand Total */}
        <div className="flex items-center justify-between font-extrabold text-zinc-900 dark:text-white mb-2.5">
          <span className="text-zinc-800 dark:text-zinc-200 font-semibold text-sm">
            Items: <span className="text-zinc-900 dark:text-white font-mono">{lines.reduce((acc, l) => acc + l.qty, 0)}</span>
          </span>
          <span className="text-sm">
            Total: <span className="font-mono text-xl text-indigo-700 dark:text-indigo-400 tabular-nums">Rs {calc.total.toFixed(2)}</span>
          </span>
        </div>

        {/* Row 2: Inline Quick Controls (Discount, Tax, Shipping) */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          
          {/* Inline Discount Control */}
          <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-800 dark:text-zinc-200 font-bold uppercase tracking-wider text-[12px]">
              <span>Discount</span>
              <button
                onClick={() => setEditingDiscountInline(!editingDiscountInline)}
                className="text-indigo-600 hover:text-indigo-700 text-[12px] font-bold"
              >
                {editingDiscountInline ? "Done" : "Edit"}
              </button>
            </div>
            {editingDiscountInline ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min="0"
                  value={discountVal}
                  onChange={(e) => setDiscountVal(Number(e.target.value) || 0)}
                  onBlur={applyInlineDiscount}
                  className="h-7 w-full rounded border border-indigo-400 bg-white px-1 font-mono text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 dark:bg-zinc-800"
                />
                <button
                  onClick={() => {
                    const nextType = discountType === "percent" ? "amount" : "percent";
                    setDiscountType(nextType);
                    if (discountVal > 0) setDiscount({ type: nextType, value: discountVal });
                  }}
                  className="h-7 px-1.5 rounded bg-zinc-200 font-bold text-[12px] text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {discountType === "percent" ? "%" : "Rs"}
                </button>
              </div>
            ) : (
              <span className="font-mono font-bold text-sm text-zinc-800 dark:text-zinc-200 mt-1 tabular-nums">
                {discount ? `${discount.value}${discount.type === "percent" ? "%" : " Rs"}` : "0.00"}
              </span>
            )}
          </div>

          {/* Tax info */}
          <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-800 dark:text-zinc-200 font-bold uppercase tracking-wider text-[12px]">
              <span>Tax Rate</span>
              <span className="text-[12px] text-zinc-400 font-normal">DB</span>
            </div>
            <span className="font-mono font-bold text-sm text-zinc-800 dark:text-zinc-200 mt-1 tabular-nums">
              {(taxRate * 100).toFixed(1)}%
            </span>
          </div>

          {/* Inline Shipping Control */}
          <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-800 dark:text-zinc-200 font-bold uppercase tracking-wider text-[12px]">
              <span>Shipping</span>
              <button
                onClick={() => setEditingShippingInline(!editingShippingInline)}
                className="text-indigo-600 hover:text-indigo-700 text-[12px] font-bold"
              >
                {editingShippingInline ? "Done" : "Edit"}
              </button>
            </div>
            {editingShippingInline ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min="0"
                  value={shippingVal}
                  onChange={(e) => setShippingVal(Number(e.target.value) || 0)}
                  onBlur={applyInlineShipping}
                  className="h-7 w-full rounded border border-indigo-400 bg-white px-1 font-mono text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 dark:bg-zinc-800"
                />
              </div>
            ) : (
              <span className="font-mono font-bold text-sm text-zinc-800 dark:text-zinc-200 mt-1 tabular-nums">
                Rs {shipping ? Number(shipping).toFixed(2) : "0.00"}
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ── Quick Add Customer Modal ───────────────────────────────────────── */}
      <Modal open={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="Quick Add Customer" closeDisabled={savingCustomer}>
        <form onSubmit={handleAddCustomer} className="flex flex-col gap-3">
          {customerError && <p role="alert" className="text-red-700">{customerError}</p>}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Full Name:*</label>
            <input aria-label="Full Name:"
              required
              autoFocus
              type="text"
              placeholder="e.g. Kasun Silva"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Phone Number:</label>
            <input aria-label="Phone Number"
              type="tel"
              placeholder="077XXXXXXX"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Email Address:</label>
            <input aria-label="Email Address"
              type="email"
              placeholder="customer@email.com"
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={savingCustomer} className="bg-indigo-650 hover:bg-indigo-750 text-white flex-1 font-bold">
              {savingCustomer ? "Saving..." : "Save Customer"}
            </Button>
            <Button type="button" variant="outline" disabled={savingCustomer} onClick={() => setIsCustomerModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Line Item Quick-Edit Popup ───────────────────────────────────────
          Replaces the old inline expand-row accordion — clicking a line's
          name opens this instead of a chevron toggling a 4-column grid in
          place. Keyed by line id so switching to a different line (without
          closing the modal in between) doesn't carry over stale uncontrolled
          input values from the previous line. */}
      <Modal
        open={!!editingLine}
        onClose={() => {
          setEditingLineId(null);
          setPriceOverrideUnlock(null);
        }}
        title={editingLine ? `${editingLine.name} - ${editingLine.sku}` : undefined}
      >
        {editingLine && (
          <div key={editingLine.id} className="flex flex-col gap-4">
            <div>
              {(() => {
                const unlockedHere = priceOverrideUnlock?.lineId === editingLine.id;
                const priceEditable = canOverridePrice || unlockedHere;
                return (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        Unit Price (Rs)
                        {!priceEditable && <span className="ml-1.5 font-normal normal-case text-zinc-400">(manager only)</span>}
                        {unlockedHere && (
                          <span className="ml-1.5 font-normal normal-case text-emerald-600">
                            (unlocked by {priceOverrideUnlock!.approverName})
                          </span>
                        )}
                      </label>
                      {/* Cashier doesn't have PRICE_OVERRIDE on their own
                          account — a manager can still unlock just this
                          one field by scanning their access card (or
                          typing their PIN) instead of the cashier logging
                          out and a manager logging back in. */}
                      {!canOverridePrice && !unlockedHere && (
                        <button
                          type="button"
                          onClick={() => setManagerPinModalOpen(true)}
                          className="flex items-center gap-1 text-[11px] font-bold text-indigo-650 hover:text-indigo-800"
                        >
                          <ScanBarcode className="h-3 w-3" /> Manager unlock
                        </button>
                      )}
                    </div>
                    <input aria-label="Unit Price (Rs)"
                      type="number"
                      step="0.01"
                      autoFocus
                      disabled={!priceEditable}
                      defaultValue={editingLine.priceOverride?.newPrice ?? editingLine.unitPrice}
                      // The Modal component's own focus-trap effect calls
                      // .focus() programmatically after mount (not the native
                      // autoFocus HTML attribute), so unlike the payment modal's
                      // tender field, there's no mount-timing race here —
                      // select() reliably highlights the whole value, matching
                      // the reference POS's pre-selected price field.
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val !== editingLine.unitPrice) {
                          const reason = unlockedHere
                            ? `Manager override (approved by ${priceOverrideUnlock!.approverName})`
                            : "Cashier adjustment";
                          setLinePriceOverride(editingLine.id, { newPrice: val, reason });
                        } else if (val === editingLine.unitPrice) {
                          setLinePriceOverride(editingLine.id, null);
                        }
                      }}
                      // canOverridePrice was fetched but never actually used to
                      // gate this field — every cashier could already freely
                      // retype the price here regardless of the PRICE_OVERRIDE
                      // permission the fetch itself was clearly meant to check.
                      // Batch-driven pricing below is intentionally NOT gated
                      // by this — picking a batch's own price isn't a
                      // discretionary override, it's just that batch's correct
                      // price, same as scanning a different SKU would be.
                      className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 font-mono text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500 disabled:cursor-not-allowed dark:disabled:bg-zinc-800"
                    />
                  </>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block mb-1">Discount Type</label>
                <select aria-label="Discount Type"
                  value={editingLine.lineDiscount?.type || "percent"}
                  onChange={(e) => {
                    const type = e.target.value as "percent" | "amount";
                    setLineDiscount(editingLine.id, { type, value: editingLine.lineDiscount?.value ?? 0 });
                  }}
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="amount">Fixed (Rs)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block mb-1">Discount Amount</label>
                <input aria-label="Discount Amount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0.00"
                  defaultValue={editingLine.lineDiscount?.value ?? ""}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val > 0) {
                      setLineDiscount(editingLine.id, { type: editingLine.lineDiscount?.type || "percent", value: val });
                    } else {
                      setLineDiscount(editingLine.id, null);
                    }
                  }}
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 font-mono text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            {/* Batch / Lot — a real picker instead of a blind free-text
                field: the same barcode can have several batches in stock
                at once (different cost, sometimes a genuinely different
                selling price — see ItemBatch.unitPrice's docs), and a
                cashier typing a batch number from memory had no way to
                know what was actually in stock, how much, or what it
                cost. Only shown when relevant to this line (tracked, or
                already tagged from before this existed). */}
            {(editingLine.trackBatch || editingLine.batchNumber) && (
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block mb-1">Batch / Lot</label>
                {batchesLoading ? (
                  <p className="text-xs text-zinc-400 py-2">Loading batches…</p>
                ) : availableBatches.length > 0 ? (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {availableBatches.map((b) => {
                      const selected = editingLine.batchNumber === b.batchNumber;
                      const price = b.unitPrice ?? editingLine.unitPrice;
                      return (
                        <button
                          key={b.batchNumber}
                          type="button"
                          onClick={() => selectBatch(editingLine.id, editingLine.unitPrice, b)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                              : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span>
                            <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">{b.batchNumber}</span>
                            <span className="ml-2 text-xs text-zinc-500">{b.qtyOnHand} left</span>
                            {b.expiryDate && (
                              <span className="ml-2 text-xs text-zinc-400">exp {new Date(b.expiryDate).toLocaleDateString()}</span>
                            )}
                          </span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            Rs {price.toFixed(2)}
                            {b.unitPrice === null && <span className="ml-1 font-normal text-zinc-400">(catalog)</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 py-2">
                    No batches currently in stock for this SKU — bring stock in via Receive Stock first.
                    {editingLine.batchNumber && ` Currently tagged: ${editingLine.batchNumber}.`}
                  </p>
                )}
              </div>
            )}

            {(editingLine.trackSerial || (editingLine.serialNumbers && editingLine.serialNumbers.length > 0)) && (
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block mb-1">Serial / IMEI</label>
                <input aria-label="Serial / IMEI"
                  type="text"
                  placeholder="Serial / IMEI number"
                  defaultValue={editingLine.serialNumbers?.[0] ?? ""}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    useCartStore.getState().setLineSerials(editingLine.id, val ? [val] : []);
                  }}
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            )}

            <Button
              type="button"
              onClick={() => {
                setEditingLineId(null);
                setPriceOverrideUnlock(null);
              }}
              className="bg-zinc-900 hover:bg-zinc-800 text-white w-full font-bold"
            >
              Close
            </Button>
          </div>
        )}
      </Modal>

      <ManagerPinModal
        open={managerPinModalOpen}
        title="Unlock Price Override"
        description="Manager: enter your PIN, or scan your access card, to allow this price change."
        onClose={() => setManagerPinModalOpen(false)}
        onSuccess={({ approverName }) => {
          if (editingLine) setPriceOverrideUnlock({ lineId: editingLine.id, approverName });
          setManagerPinModalOpen(false);
        }}
      />

    </div>
  );
}
