"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useCartStore, type CartLine } from "@/lib/pos/cart-store";
import { calculateCart, applyDiscount, applyLineOverridesAndDiscounts, type CartCalculation } from "@/lib/pos/pricing";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CustomerCombobox } from "@/app/_components/CustomerCombobox";
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
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

type Product = {
  sku: string;
  name: string;
  unitPrice: number;
  qtyOnHand: number;
};

export function CartPanel({
  products: propProducts,
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

  // Accordion state for line items (expanded SKU)
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

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
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [canOverridePrice, setCanOverridePrice] = useState(false);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/pos/permissions")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCanOverridePrice(Boolean(res.data.priceOverride));
      });
  }, []);

  const [customerLoyalty, setCustomerLoyalty] = useState<{
    loyaltyPoints: number;
    loyaltyTier: string;
    maxDiscountValue: number;
  } | null>(null);

  useEffect(() => {
    if (!propProducts) {
      fetch("/api/pos/products")
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setLocalProducts(res.data);
        });
    }
  }, [propProducts]);

  useEffect(() => {
    if (!customerId) {
      // Clearing stale loyalty data for the previous customer the instant
      // the selection changes/clears — synchronizing to an external prop
      // change, not state that could be derived during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomerLoyalty(null);
      return;
    }
    fetch(`/api/customers/loyalty?customerId=${customerId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setCustomerLoyalty(res.data);
        }
      })
      .catch(() => {});
  }, [customerId]);

  const products = propProducts ?? localProducts;

  // Filter products for the inline search bar
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [products, productQuery]);

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

  // Remove line with undo support
  function handleRemoveItemWithUndo(line: CartLine, index: number) {
    setLastDeletedItem({ item: line, index });
    removeItem(line.sku);
    setTimeout(() => {
      setLastDeletedItem((prev) => (prev?.item.sku === line.sku ? null : prev));
    }, 6000);
  }

  function handleUndoDelete() {
    if (!lastDeletedItem) return;
    addItem(lastDeletedItem.item);
    setLastDeletedItem(null);
  }

  // Create new customer
  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomerName || savingCustomer) return;

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
    } catch (err) {
      console.error(err);
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
    <div className="flex flex-1 flex-col rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 min-h-0">
      
      {/* ── Top Bar: Customer Selector + Add Customer ──────────────────────── */}
      <div className="mb-2.5 flex items-center gap-2">
        <CustomerCombobox
          id="pos-customer-select"
          value={customerId || null}
          displayName={customerName ?? null}
          onChange={(c) => setCustomer(c)}
        />
        <button
          onClick={() => setIsCustomerModalOpen(true)}
          className="flex h-9 px-2.5 items-center gap-1 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 text-xs font-bold transition"
          title="Add New Customer"
        >
          <UserPlus className="h-4 w-4" />
          <span>New</span>
        </button>
      </div>

      {/* Customer Loyalty Tier & Points Badge */}
      {customerLoyalty && (
        <div className="mb-2.5 flex items-center justify-between p-2 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs dark:bg-indigo-950/30 dark:border-indigo-900/40">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-300">
            <span className="px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800 text-[10px] font-extrabold uppercase dark:bg-indigo-900 dark:text-indigo-200">
              🏆 {customerLoyalty.loyaltyTier} Member
            </span>
            <span>{customerLoyalty.loyaltyPoints} Pts (Rs {customerLoyalty.maxDiscountValue.toFixed(2)})</span>
          </div>

          {loyaltyRedeem ? (
            <button
              onClick={clearLoyaltyRedeem}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-red-600 text-white font-extrabold text-[10px] transition shadow-2xs"
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
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] transition shadow-2xs"
              >
                Apply Loyalty Disc
              </button>
            )
          )}
        </div>
      )}

      {/* ── Quick Product Search & Scan ────────────────────────────────────── */}
      <div className="relative mb-2.5 flex gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Scan SKU / Barcode / Search..."
            value={productQuery}
            onChange={(e) => {
              setProductQuery(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-8 text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900"
          />
          {productQuery && (
            <button
              onClick={() => {
                setProductQuery("");
                setShowProductDropdown(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {showProductDropdown && filteredProducts.length > 0 && (
          <div className="absolute left-0 right-0 top-10 z-30 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            {filteredProducts.map((p) => (
              <button
                key={p.sku}
                onClick={() => {
                  addItem(p);
                  setProductQuery("");
                  setShowProductDropdown(false);
                }}
                disabled={p.qtyOnHand <= 0}
                className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-indigo-50/60 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
              >
                <div>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">{p.name}</p>
                  <p className="text-[10px] font-mono text-zinc-400">{p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Rs {p.unitPrice.toFixed(2)}</p>
                  <p className="text-[10px] text-zinc-400">{p.qtyOnHand} in stock</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
      <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-lg mb-2.5 dark:border-zinc-800 scrollbar-thin min-h-[160px]">
        <table className="w-full text-xs table-fixed">
          <thead className="bg-zinc-50 sticky top-0 text-left font-bold text-zinc-500 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 z-10 select-none">
            <tr>
              <th className="px-3 py-2 w-[48%]">Item</th>
              <th className="px-1 py-2 text-center w-[24%]">Qty</th>
              <th className="px-2 py-2 text-right w-[20%]">Total</th>
              <th className="px-1 py-2 text-center w-[8%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-zinc-400">
                  <p className="text-xs font-semibold">Cart is currently empty</p>
                  <p className="text-[11px] text-zinc-400 mt-1">Scan an item or select from the product catalog</p>
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => {
                const lineCalc = calc.lines.find((l) => l.sku === line.sku);
                const sub = lineCalc ? lineCalc.lineSubtotal : line.qty * line.unitPrice;
                const isExpanded = expandedSku === line.sku;

                return (
                  <React.Fragment key={line.sku}>
                    <tr className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition ${isExpanded ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""}`}>
                      {/* Product Name & SKU */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setExpandedSku(isExpanded ? null : line.sku)}
                            className="text-zinc-400 hover:text-indigo-600 transition"
                            title="Edit price override, discount, or serial note"
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-indigo-600" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          <div className="truncate">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{line.name}</p>
                            <p className="text-[10px] font-mono text-zinc-400 tabular-nums">
                              {line.priceOverride ? (
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
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Quantity Stepper */}
                      <td className="px-1 py-2 text-center">
                        <div className="inline-flex items-center border border-zinc-200 rounded-md bg-white dark:border-zinc-700 dark:bg-zinc-900 shadow-2xs">
                          <button
                            onClick={() => setQty(line.sku, Math.max(0, line.qty - 1))}
                            className="h-6 w-5 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l transition"
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.qty}
                            onChange={(e) => setQty(line.sku, Math.max(0, parseFloat(e.target.value) || 0))}
                            className="h-6 w-8 text-center text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-indigo-500 rounded dark:bg-zinc-900 text-zinc-900 dark:text-white tabular-nums"
                          />
                          <button
                            onClick={() => setQty(line.sku, line.qty + 1)}
                            className="h-6 w-5 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r transition"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </td>

                      {/* Subtotal */}
                      <td className="px-2 py-2 text-right font-mono font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        Rs {sub.toFixed(2)}
                      </td>

                      {/* Delete */}
                      <td className="px-1 py-2 text-center">
                        <button
                          onClick={() => handleRemoveItemWithUndo(line, idx)}
                          className="h-6 w-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                          title="Remove item"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* ── Expandable Row for Line Discounts, Price Overrides, Notes ── */}
                    {isExpanded && (
                      <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40">
                        <td colSpan={4} className="p-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                            
                            {/* Price Override */}
                            <div>
                              <label className="font-bold text-zinc-600 dark:text-zinc-400 block mb-1">Unit Price Override (Rs):</label>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={line.priceOverride?.newPrice ?? line.unitPrice}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val !== line.unitPrice) {
                                    setLinePriceOverride(line.sku, { newPrice: val, reason: "Cashier adjustment" });
                                  } else if (val === line.unitPrice) {
                                    setLinePriceOverride(line.sku, null);
                                  }
                                }}
                                className="h-7 w-full rounded border border-zinc-300 bg-white px-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                              />
                            </div>

                            {/* Line Discount */}
                            <div>
                              <label className="font-bold text-zinc-600 dark:text-zinc-400 block mb-1">Line Discount (% or Rs):</label>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  defaultValue={line.lineDiscount?.value ?? ""}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (val > 0) {
                                      setLineDiscount(line.sku, { type: line.lineDiscount?.type || "percent", value: val });
                                    } else {
                                      setLineDiscount(line.sku, null);
                                    }
                                  }}
                                  className="h-7 flex-1 rounded border border-zinc-300 bg-white px-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                                />
                                <select
                                  value={line.lineDiscount?.type || "percent"}
                                  onChange={(e) => {
                                    const type = e.target.value as "percent" | "amount";
                                    if (line.lineDiscount) {
                                      setLineDiscount(line.sku, { ...line.lineDiscount, type });
                                    }
                                  }}
                                  className="h-7 rounded border border-zinc-300 bg-white px-1.5 text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                                >
                                  <option value="percent">%</option>
                                  <option value="amount">Rs</option>
                                </select>
                              </div>
                            </div>

                            {/* Serial / Notes */}
                            <div>
                              <label className="font-bold text-zinc-600 dark:text-zinc-400 block mb-1">IMEI / Serial / Note:</label>
                              <input
                                type="text"
                                placeholder="Serial / custom note..."
                                defaultValue={line.description ?? ""}
                                onBlur={(e) => setLineDescription(line.sku, e.target.value.trim() || null)}
                                className="h-7 w-full rounded border border-zinc-300 bg-white px-2 text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                              />
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Cart Totals Summary (Inline Editable Controls) ─────────────────── */}
      <div className="border-t border-zinc-200 pt-2.5 dark:border-zinc-800 select-none">
        
        {/* Row 1: Subtotal, Items count, Grand Total */}
        <div className="flex items-center justify-between text-sm font-extrabold text-zinc-900 dark:text-white mb-2">
          <span className="text-zinc-500 font-semibold text-xs">
            Items: <span className="text-zinc-900 dark:text-white font-mono">{lines.reduce((acc, l) => acc + l.qty, 0)}</span>
          </span>
          <span>
            Total: <span className="font-mono text-base text-indigo-700 dark:text-indigo-400 tabular-nums">Rs {calc.total.toFixed(2)}</span>
          </span>
        </div>

        {/* Row 2: Inline Quick Controls (Discount, Tax, Shipping) */}
        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          
          {/* Inline Discount Control */}
          <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              <span>Discount</span>
              <button
                onClick={() => setEditingDiscountInline(!editingDiscountInline)}
                className="text-indigo-600 hover:text-indigo-700 text-[10px] font-bold"
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
                  className="h-6 w-full rounded border border-indigo-400 bg-white px-1 font-mono text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 dark:bg-zinc-800"
                />
                <button
                  onClick={() => {
                    const nextType = discountType === "percent" ? "amount" : "percent";
                    setDiscountType(nextType);
                    if (discountVal > 0) setDiscount({ type: nextType, value: discountVal });
                  }}
                  className="h-6 px-1.5 rounded bg-zinc-200 font-bold text-[10px] text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {discountType === "percent" ? "%" : "Rs"}
                </button>
              </div>
            ) : (
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-1 tabular-nums">
                {discount ? `${discount.value}${discount.type === "percent" ? "%" : " Rs"}` : "0.00"}
              </span>
            )}
          </div>

          {/* Tax info */}
          <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              <span>Tax Rate</span>
              <span className="text-[10px] text-zinc-400 font-normal">DB</span>
            </div>
            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-1 tabular-nums">
              {(taxRate * 100).toFixed(1)}%
            </span>
          </div>

          {/* Inline Shipping Control */}
          <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              <span>Shipping</span>
              <button
                onClick={() => setEditingShippingInline(!editingShippingInline)}
                className="text-indigo-600 hover:text-indigo-700 text-[10px] font-bold"
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
                  className="h-6 w-full rounded border border-indigo-400 bg-white px-1 font-mono text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 dark:bg-zinc-800"
                />
              </div>
            ) : (
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-1 tabular-nums">
                Rs {shipping ? Number(shipping).toFixed(2) : "0.00"}
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ── Quick Add Customer Modal ───────────────────────────────────────── */}
      <Modal open={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="Quick Add Customer">
        <form onSubmit={handleAddCustomer} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Full Name:*</label>
            <input
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
            <input
              type="tel"
              placeholder="077XXXXXXX"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Email Address:</label>
            <input
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

    </div>
  );
}
