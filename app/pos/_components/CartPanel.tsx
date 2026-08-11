"use client";

import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/lib/pos/cart-store";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { calculateCart, applyDiscount, applyLineOverridesAndDiscounts, type CartCalculation } from "@/lib/pos/pricing";
import {
  User,
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
} from "lucide-react";

type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

type Product = {
  sku: string;
  name: string;
  unitPrice: number;
  qtyOnHand: number;
};

export function CartPanel({
  products: propProducts,
  calculation,
}: {
  /** Pre-loaded product list from PosPage — avoids duplicate /api/pos/products fetch */
  products?: Product[];
  /** Pre-computed pricing from PosPage — avoids duplicate calculateCart call */
  calculation?: CartCalculation;
}) {
  const {
    lines,
    discount,
    shipping,
    customerId,
    customerName,
    addItem,
    removeItem,
    setQty,
    setLinePriceOverride,
    setLineDiscount,
    setDiscount,
    setShipping,
    setCustomer,
  } = useCartStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);

  // Per-line edit (price override + line discount) — one modal shared by
  // every row, keyed by which sku is currently being edited.
  const [editingLineSku, setEditingLineSku] = useState<string | null>(null);
  const [canOverridePrice, setCanOverridePrice] = useState(false);
  const [lineOverridePrice, setLineOverridePrice] = useState("");
  const [lineOverrideReason, setLineOverrideReason] = useState("");
  const [lineDiscountType, setLineDiscountType] = useState<"percent" | "amount">("percent");
  const [lineDiscountValue, setLineDiscountValue] = useState("");

  // Modal input values
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [discountVal, setDiscountVal] = useState(discount?.value || 0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">(discount?.type || "percent");
  
  // Tax state (stored locally in POS screen, defaulting to 8% standard)
  const [taxRate, setTaxRate] = useState(8);
  const [taxInput, setTaxInput] = useState("8");

  const [shippingVal, setShippingVal] = useState(shipping || 0);

  const [localProducts, setLocalProducts] = useState<Product[]>([]);

  // Whether this cashier is allowed to override a line's price — checked
  // once on mount; the control below is hidden entirely if not (checkout
  // also re-checks server-side, this is just UI, not the real gate).
  useEffect(() => {
    fetch("/api/pos/permissions")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCanOverridePrice(Boolean(res.data.priceOverride));
      });
  }, []);

  // Fetch Customers and fallback products if not supplied by parent
  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCustomers(res.data);
      });

    if (!propProducts) {
      fetch("/api/pos/products")
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setLocalProducts(res.data);
        });
    }
  }, [propProducts]);

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

  // Use parent-supplied calculation if available; fall back to local
  // computation only if CartPanel is rendered without a parent-supplied value.
  const localCalculation = useMemo(() => {
    if (calculation) return calculation; // parent already computed this
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

  // Alias for template use
  const calc = localCalculation;

  // Create new customer quick action
  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomerName) return;

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
        setCustomers((prev) => [...prev, body.data]);
        setCustomer({ id: body.data.id, name: body.data.name });
        setNewCustomerName("");
        setNewCustomerEmail("");
        setNewCustomerPhone("");
        setIsCustomerModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Open the per-line edit modal (price override + line discount),
  // pre-filled with that line's current values if it already has any.
  function openLineEdit(sku: string) {
    const line = lines.find((l) => l.sku === sku);
    setLineOverridePrice(line?.priceOverride ? String(line.priceOverride.newPrice) : "");
    setLineOverrideReason(line?.priceOverride?.reason ?? "");
    setLineDiscountType(line?.lineDiscount?.type ?? "percent");
    setLineDiscountValue(line?.lineDiscount ? String(line.lineDiscount.value) : "");
    setEditingLineSku(sku);
  }

  function handleSaveLineEdit() {
    if (!editingLineSku) return;

    if (canOverridePrice && lineOverridePrice && lineOverrideReason.trim()) {
      setLinePriceOverride(editingLineSku, { newPrice: Number(lineOverridePrice), reason: lineOverrideReason.trim() });
    } else {
      setLinePriceOverride(editingLineSku, null);
    }

    if (lineDiscountValue && Number(lineDiscountValue) > 0) {
      setLineDiscount(editingLineSku, { type: lineDiscountType, value: Number(lineDiscountValue) });
    } else {
      setLineDiscount(editingLineSku, null);
    }

    setEditingLineSku(null);
  }

  // Update Discount
  function handleSaveDiscount() {
    if (discountVal > 0) {
      setDiscount({ type: discountType, value: discountVal });
    } else {
      setDiscount(null);
    }
    setIsDiscountModalOpen(false);
  }

  // Update Tax
  function handleSaveTax() {
    setTaxRate(Number(taxInput) || 0);
    setIsTaxModalOpen(false);
  }

  // Update Shipping
  function handleSaveShipping() {
    setShipping(shippingVal);
    setIsShippingModalOpen(false);
  }

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 min-h-0">
      
      {/* Customer Selector dropdown + Add Customer button */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
            <User className="h-4 w-4" />
          </div>
          <select
            value={customerId || ""}
            onChange={(e) => {
              const selected = customers.find((c) => c.id === e.target.value);
              if (selected) {
                setCustomer({ id: selected.id, name: selected.name });
              } else {
                setCustomer(null);
              }
            }}
            className="h-9 w-full rounded border border-zinc-300 bg-transparent pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Walk-In Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setIsCustomerModalOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 transition"
          title="Add Customer"
        >
          <UserPlus className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Barcode / SKU / Name Search input */}
      <div className="relative mb-3">
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Enter Product name / SKU / Scan bar code"
            value={productQuery}
            onChange={(e) => {
              setProductQuery(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            className="h-9 w-full rounded border border-zinc-300 bg-transparent pl-9 pr-10 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
          />
          {productQuery && (
            <button
              onClick={() => {
                setProductQuery("");
                setShowProductDropdown(false);
              }}
              className="absolute right-3 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Local Search Dropdown */}
        {showProductDropdown && filteredProducts.length > 0 && (
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {filteredProducts.map((p) => (
              <button
                key={p.sku}
                onClick={() => {
                  addItem(p);
                  setProductQuery("");
                  setShowProductDropdown(false);
                }}
                disabled={p.qtyOnHand <= 0}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">{p.name}</p>
                  <p className="text-xs text-zinc-400">{p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-medium">Rs {p.unitPrice.toFixed(2)}</p>
                  <p className="text-xs text-zinc-400">{p.qtyOnHand} in stock</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Cart Items List */}
      <div className="flex-1 min-h-[280px] overflow-y-auto border border-zinc-150 rounded-md mb-3 dark:border-zinc-800 scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 sticky top-0 text-left text-sm font-bold text-zinc-500 border-b dark:bg-zinc-900 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2 text-center">Quantity</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
              <th className="px-4 py-2 text-center w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-zinc-400 text-sm">
                  No products added to the invoice yet.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                // Calculate individual subtotal including proportional discount if applied
                const lineCalc = calc.lines.find((l) => l.sku === line.sku);
                // lineSubtotal is the post-discount total for this line
                const sub = lineCalc ? lineCalc.lineSubtotal : line.qty * line.unitPrice;

                return (
                  <tr key={line.sku} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="px-4 py-1.5">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">{line.name}</p>
                      {line.priceOverride ? (
                        <p className="text-sm font-mono">
                          <span className="text-zinc-400 line-through mr-1.5">Rs {line.unitPrice.toFixed(2)}</span>
                          <span className="text-amber-650 font-bold">Rs {line.priceOverride.newPrice.toFixed(2)}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-450 dark:text-zinc-500 font-mono">Rs {line.unitPrice.toFixed(2)}</p>
                      )}
                      {(line.priceOverride || line.lineDiscount) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {line.priceOverride && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px] font-bold dark:bg-amber-950/30 dark:text-amber-400" title={line.priceOverride.reason}>
                              <ShieldAlert className="h-2.5 w-2.5" /> Price overridden
                            </span>
                          )}
                          {line.lineDiscount && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-650 text-[11px] font-bold dark:bg-indigo-950/30 dark:text-indigo-400">
                              <Tag className="h-2.5 w-2.5" />
                              {line.lineDiscount.type === "amount" ? `Rs ${line.lineDiscount.value}` : `${line.lineDiscount.value}%`} off
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setQty(line.sku, line.qty - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-zinc-300 hover:bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          value={line.qty}
                          onChange={(e) => setQty(line.sku, Number(e.target.value))}
                          className="h-6 w-10 border border-zinc-300 rounded text-center text-xs font-mono outline-none dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <button
                          onClick={() => setQty(line.sku, line.qty + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-zinc-300 hover:bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono font-medium">
                      Rs {sub.toFixed(2)}
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openLineEdit(line.sku)}
                          className="text-zinc-400 hover:text-indigo-600"
                          title="Price override / line discount"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeItem(line.sku)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Cart Summary Totals Block */}
      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        
        {/* Row 1: Items & Total display */}
        <div className="flex items-center justify-between text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">
          <span>Items: {lines.reduce((acc, l) => acc + l.qty, 0)}</span>
          <span className="text-base text-zinc-900 dark:text-white">
            Total: <span className="font-mono">Rs {calc.total.toFixed(2)}</span>
          </span>
        </div>

        {/* Row 2: Discount, Tax, Shipping buttons with Edit icons */}
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          
          {/* Discount Button */}
          <button
            onClick={() => setIsDiscountModalOpen(true)}
            className="flex items-center justify-between rounded border border-zinc-200 p-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 text-left"
          >
            <div className="flex items-center gap-1">
              <Percent className="h-3.5 w-3.5 text-indigo-500" />
              <div>
                <p className="text-xs text-zinc-450 dark:text-zinc-500 font-bold uppercase">Discount (-)</p>
                <p className="font-mono mt-0.5 text-zinc-700 dark:text-zinc-300">
                  {discount ? `${discount.type === "amount" ? "Rs " : ""}${discount.value}${discount.type === "percent" ? "%" : ""}` : "0.00"}
                </p>
              </div>
            </div>
            <Edit className="h-3 w-3 text-zinc-400" />
          </button>

          {/* Tax Button */}
          <button
            onClick={() => setIsTaxModalOpen(true)}
            className="flex items-center justify-between rounded border border-zinc-200 p-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 text-left"
          >
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <div>
                <p className="text-xs text-zinc-450 dark:text-zinc-500 font-bold uppercase">Order Tax (+)</p>
                <p className="font-mono mt-0.5 text-zinc-700 dark:text-zinc-300">{taxRate}%</p>
              </div>
            </div>
            <Edit className="h-3 w-3 text-zinc-400" />
          </button>

          {/* Shipping Button */}
          <button
            onClick={() => setIsShippingModalOpen(true)}
            className="flex items-center justify-between rounded border border-zinc-200 p-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 text-left"
          >
            <div className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 text-amber-500" />
              <div>
                <p className="text-xs text-zinc-450 dark:text-zinc-500 font-bold uppercase">Shipping (+)</p>
                <p className="font-mono mt-0.5 text-zinc-700 dark:text-zinc-300">Rs {shipping.toFixed(2)}</p>
              </div>
            </div>
            <Edit className="h-3 w-3 text-zinc-400" />
          </button>

        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* POPUP MODALS FOR SETTINGS */}
      {/* ────────────────────────────────────────────────────────────────── */}

      {/* Add Customer Modal */}
      <Modal open={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="Add Customer">
        <form onSubmit={handleAddCustomer} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Name:*</label>
            <input
              required
              type="text"
              placeholder="Customer Name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Email:</label>
            <input
              type="email"
              placeholder="customer@email.com"
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Phone:</label>
            <input
              type="tel"
              placeholder="077XXXXXXXX"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1">Save Customer</Button>
            <Button type="button" variant="outline" onClick={() => setIsCustomerModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Discount Modal */}
      <Modal open={isDiscountModalOpen} onClose={() => setIsDiscountModalOpen(false)} title="Edit Discount">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setDiscountType("percent")}
              className={`flex-1 h-9 rounded border text-sm font-semibold capitalize ${
                discountType === "percent"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20"
                  : "border-zinc-200"
              }`}
            >
              Percentage (%)
            </button>
            <button
              onClick={() => setDiscountType("amount")}
              className={`flex-1 h-9 rounded border text-sm font-semibold capitalize ${
                discountType === "amount"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20"
                  : "border-zinc-200"
              }`}
            >
              Fixed Amount (Rs)
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Discount Value:</label>
            <input
              type="number"
              min={0}
              value={discountVal}
              onChange={(e) => setDiscountVal(Number(e.target.value) || 0)}
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveDiscount} className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1">Apply Discount</Button>
            <Button variant="outline" onClick={() => setIsDiscountModalOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Tax Modal */}
      <Modal open={isTaxModalOpen} onClose={() => setIsTaxModalOpen(false)} title="Edit Tax Rate">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Order Tax Rate (%):</label>
            <input
              type="number"
              min={0}
              value={taxInput}
              onChange={(e) => setTaxInput(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveTax} className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1">Apply Tax</Button>
            <Button variant="outline" onClick={() => setIsTaxModalOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Shipping Modal */}
      <Modal open={isShippingModalOpen} onClose={() => setIsShippingModalOpen(false)} title="Edit Shipping Cost">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Shipping Charge (Rs):</label>
            <input
              type="number"
              min={0}
              value={shippingVal}
              onChange={(e) => setShippingVal(Number(e.target.value) || 0)}
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveShipping} className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1">Apply Shipping</Button>
            <Button variant="outline" onClick={() => setIsShippingModalOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Line Item Modal — price override + line discount, the same
          point in the flow per design (both only make sense at checkout,
          not as separate admin screens). */}
      <Modal
        open={editingLineSku !== null}
        onClose={() => setEditingLineSku(null)}
        title={`Edit ${lines.find((l) => l.sku === editingLineSku)?.name ?? "Item"}`}
      >
        <div className="flex flex-col gap-5">
          {canOverridePrice ? (
            <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/10">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" /> Price Override
              </p>
              <label className="text-xs font-semibold text-zinc-500">New unit price (Rs) — leave blank to use catalog price:</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={lineOverridePrice}
                onChange={(e) => setLineOverridePrice(e.target.value)}
                placeholder="e.g. damaged item, reduced price"
                className="h-9 w-full rounded border border-zinc-300 bg-white px-3 text-sm font-mono outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
              <label className="text-xs font-semibold text-zinc-500">Reason (required, audit-logged):</label>
              <input
                type="text"
                value={lineOverrideReason}
                onChange={(e) => setLineOverrideReason(e.target.value)}
                placeholder="e.g. Scratched packaging, manager approved"
                className="h-9 w-full rounded border border-zinc-300 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              Price override requires manager/admin permission — not available on this account.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-indigo-650 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Line Discount
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setLineDiscountType("percent")}
                className={`flex-1 h-9 rounded border text-sm font-semibold ${
                  lineDiscountType === "percent" ? "border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20" : "border-zinc-200"
                }`}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setLineDiscountType("amount")}
                className={`flex-1 h-9 rounded border text-sm font-semibold ${
                  lineDiscountType === "amount" ? "border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20" : "border-zinc-200"
                }`}
              >
                Fixed Amount (Rs)
              </button>
            </div>
            <input
              type="number"
              min={0}
              value={lineDiscountValue}
              onChange={(e) => setLineDiscountValue(e.target.value)}
              placeholder="0 — leave blank for no line discount"
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700"
            />
          </div>

          <div className="flex gap-2 border-t pt-3 dark:border-zinc-800">
            <Button onClick={handleSaveLineEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1">Save</Button>
            <Button variant="outline" onClick={() => setEditingLineSku(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
