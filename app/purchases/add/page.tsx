"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, PackagePlus, Sparkles, X, ShoppingCart, Store, CreditCard, Building2 } from "lucide-react";
import Link from "next/link";

type Supplier = { id: string; name: string };
type Location = { id: string; name: string; code: string; isDefault: boolean };
type Product = { sku: string; name: string; unitPrice: number; category?: string; brand?: string };

type Line = {
  id: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  qty: number;
  unitCost: number;
  unitPrice?: number;
  isNewProduct?: boolean;
};

const currencyFmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AddPurchasePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [lines, setLines] = useState<Line[]>([]);

  const [productQuery, setProductQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Quick Register Modal state
  const [showModal, setShowModal] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductBrand, setNewProductBrand] = useState("");
  const [newProductCost, setNewProductCost] = useState<number | "">("");
  const [newProductPrice, setNewProductPrice] = useState<number | "">("");
  const [newProductQty, setNewProductQty] = useState<number>(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then((res) => {
      if (res.success) setSuppliers(res.data);
    });
    fetch("/api/admin/locations").then((r) => r.json()).then((res) => {
      if (res.success) {
        setLocations(res.data);
        const def = res.data.find((l: Location) => l.isDefault);
        if (def) setLocationId(def.id);
      }
    });
    fetch("/api/pos/products").then((r) => r.json()).then((res) => {
      if (res.success) setProducts(res.data);
    });
    fetch("/api/inventory/categories").then((r) => r.json()).then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data.map((c: { name: string } | string) => (typeof c === "string" ? c : c.name)));
      }
    });
    fetch("/api/inventory/brands").then((r) => r.json()).then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setBrands(res.data.map((b: { name: string } | string) => (typeof b === "string" ? b : b.name)));
      }
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, productQuery]);

  function addExistingProductLine(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => !l.isNewProduct && l.sku === p.sku);
      if (existing) {
        return prev.map((l) => (l.id === existing.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          id: `line-${Date.now()}-${Math.random()}`,
          sku: p.sku,
          name: p.name,
          category: p.category,
          brand: p.brand,
          qty: 1,
          unitCost: Number((p.unitPrice * 0.7).toFixed(2)),
          unitPrice: p.unitPrice,
          isNewProduct: false,
        },
      ];
    });
    setProductQuery("");
    setShowDropdown(false);
  }

  function startRegisteringNewProduct(defaultName = "") {
    setNewProductName(defaultName || productQuery);
    setNewProductSku("");
    setNewProductCategory("");
    setNewProductBrand("");
    setNewProductCost("");
    setNewProductPrice("");
    setNewProductQty(1);
    setShowModal(true);
    setShowDropdown(false);
  }

  function handleRegisterModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const cost = typeof newProductCost === "number" ? newProductCost : 0;
    const price = typeof newProductPrice === "number" ? newProductPrice : Number((cost * 1.3).toFixed(2));

    setLines((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        sku: newProductSku.trim(),
        name: newProductName.trim(),
        category: newProductCategory.trim() || undefined,
        brand: newProductBrand.trim() || undefined,
        qty: Math.max(1, newProductQty || 1),
        unitCost: cost,
        unitPrice: price,
        isNewProduct: true,
      },
    ]);

    setShowModal(false);
    setProductQuery("");
  }

  function addBlankNewProductLine() {
    setLines((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        sku: "",
        name: "New Product",
        qty: 1,
        unitCost: 0,
        unitPrice: 0,
        isNewProduct: true,
      },
    ]);
  }

  function updateLineField<K extends keyof Line>(id: string, field: K, value: Line[K]) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === "unitCost" && l.isNewProduct && (!l.unitPrice || l.unitPrice === Number((l.unitCost * 1.3).toFixed(2)))) {
          updated.unitPrice = Number(((value as number) * 1.3).toFixed(2));
        }
        return updated;
      })
    );
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const total = lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one product line.");
      return;
    }

    const invalidNew = lines.find((l) => l.isNewProduct && !l.name.trim());
    if (invalidNew) {
      setError("Please provide a name for all registered new products.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          locationId: locationId || undefined,
          referenceNo: referenceNo || undefined,
          paymentMethod,
          amountPaid: total,
          items: lines.map((l) => ({
            sku: l.sku.trim() || undefined,
            name: l.name.trim(),
            category: l.category?.trim() || undefined,
            brand: l.brand?.trim() || undefined,
            qty: l.qty,
            unitCost: l.unitCost,
            unitPrice: l.unitPrice,
            isNewProduct: l.isNewProduct,
          })),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to save purchase.");
        return;
      }
      router.push("/purchases");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header Container */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases"
            className="p-2 rounded-xl bg-zinc-100 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/70 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Create Purchase Order</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Receive goods from suppliers &amp; auto-register new products directly into inventory stock.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => startRegisteringNewProduct("")}
          className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs active:scale-98"
        >
          <PackagePlus className="h-4 w-4 text-indigo-600" /> + Register New Product
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Purchase Order Metadata */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-150 pb-3">
            <Building2 className="h-4 w-4 text-indigo-650" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Order Header &amp; Vendor</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Supplier / Vendor *
              </label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-300/80 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Receiving Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-300/80 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Reference / PO No.
              </label>
              <input
                placeholder="Auto-generated (e.g. PO-1724...)"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-300/80 px-3.5 text-sm font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-300/80 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Credit / On Account</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Items & Product Line Items */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-indigo-650" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Line Items &amp; Stock Credit</h2>
            </div>
            <span className="text-xs text-zinc-400 font-medium">
              Add catalog products or register new items on purchase fields
            </span>
          </div>

          {/* Search & Quick Dropdown */}
          <div className="relative">
            <input
              placeholder="Search catalog product by Name / SKU, or type name to register new item…"
              value={productQuery}
              onChange={(e) => {
                setProductQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="h-11 w-full rounded-xl border border-zinc-300/80 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white shadow-xs"
            />

            {showDropdown && (
              <div className="absolute z-20 mt-1.5 w-full bg-white border border-zinc-200/90 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-zinc-100">
                {filteredProducts.map((p) => (
                  <button
                    type="button"
                    key={p.sku}
                    onClick={() => addExistingProductLine(p)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50/40 flex items-center justify-between transition"
                  >
                    <div>
                      <span className="font-semibold text-zinc-900">{p.name}</span>{" "}
                      <span className="text-xs text-zinc-400 font-mono">({p.sku})</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-zinc-600">
                      Catalog Price: {currencyFmt(p.unitPrice)}
                    </span>
                  </button>
                ))}

                {productQuery.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => startRegisteringNewProduct(productQuery)}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-indigo-650 hover:bg-indigo-50 flex items-center gap-2 bg-indigo-50/30 transition"
                  >
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Register &quot;{productQuery}&quot; as a new product in this purchase order
                  </button>
                )}

                {filteredProducts.length === 0 && !productQuery.trim() && (
                  <div className="p-4 text-center text-xs text-zinc-400">
                    Search catalog products or click &quot;+ Register New Product&quot;.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="border border-zinc-200/80 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3">Item &amp; Details</th>
                  <th className="px-3 py-3 w-28">SKU</th>
                  <th className="px-3 py-3 w-28">Category</th>
                  <th className="px-3 py-3 w-24 text-center">Qty</th>
                  <th className="px-3 py-3 w-28 text-right">Unit Cost</th>
                  <th className="px-3 py-3 w-28 text-right">Selling Price</th>
                  <th className="px-4 py-3 w-36 text-right">Line Total</th>
                  <th className="px-3 py-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70">
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                      <p className="font-semibold text-zinc-600">No purchase items added yet.</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Search catalog products above or register a new product for this purchase order.
                      </p>
                    </td>
                  </tr>
                )}

                {lines.map((l) => (
                  <tr
                    key={l.id}
                    className={l.isNewProduct ? "bg-amber-50/20 transition-colors" : "hover:bg-zinc-50/50 transition-colors"}
                  >
                    {/* Item Name */}
                    <td className="px-4 py-3">
                      {l.isNewProduct ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200">
                            New Registration
                          </span>
                          <input
                            type="text"
                            placeholder="Product Name *"
                            value={l.name}
                            onChange={(e) => updateLineField(l.id, "name", e.target.value)}
                            className="h-8.5 w-full rounded-lg border border-amber-300 px-2.5 text-xs font-bold outline-none focus:border-indigo-500 bg-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-zinc-800">{l.name}</div>
                          <div className="text-[10px] text-zinc-400">Existing product catalog item</div>
                        </div>
                      )}
                    </td>

                    {/* SKU */}
                    <td className="px-3 py-3">
                      {l.isNewProduct ? (
                        <input
                          type="text"
                          placeholder="Auto SKU"
                          value={l.sku}
                          onChange={(e) => updateLineField(l.id, "sku", e.target.value)}
                          className="h-8.5 w-full rounded-lg border border-zinc-300 px-2 text-xs font-mono outline-none focus:border-indigo-500 bg-white"
                        />
                      ) : (
                        <span className="font-mono text-zinc-600 font-medium">{l.sku}</span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-3 py-3">
                      {l.isNewProduct ? (
                        <input
                          type="text"
                          list="category-suggestions"
                          placeholder="Category"
                          value={l.category || ""}
                          onChange={(e) => updateLineField(l.id, "category", e.target.value)}
                          className="h-8.5 w-full rounded-lg border border-zinc-300 px-2 text-xs outline-none focus:border-indigo-500 bg-white"
                        />
                      ) : (
                        <span className="text-zinc-500">{l.category || "—"}</span>
                      )}
                    </td>

                    {/* Qty */}
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) =>
                          updateLineField(l.id, "qty", Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="h-8.5 w-20 rounded-lg border border-zinc-300 px-2 text-center font-mono outline-none focus:border-indigo-500 bg-white font-bold"
                      />
                    </td>

                    {/* Unit Cost */}
                    <td className="px-3 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.unitCost}
                        onChange={(e) =>
                          updateLineField(l.id, "unitCost", Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        className="h-8.5 w-24 rounded-lg border border-zinc-300 px-2 text-right font-mono outline-none focus:border-indigo-500 bg-white font-bold"
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="px-3 py-3 text-right">
                      {l.isNewProduct ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Selling"
                          value={l.unitPrice ?? ""}
                          onChange={(e) =>
                            updateLineField(l.id, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="h-8.5 w-24 rounded-lg border border-amber-300 px-2 text-right font-mono outline-none focus:border-indigo-500 bg-white font-bold"
                        />
                      ) : (
                        <span className="font-mono text-zinc-600 font-medium">
                          {l.unitPrice ? currencyFmt(l.unitPrice) : "—"}
                        </span>
                      )}
                    </td>

                    {/* Line Total */}
                    <td className="px-4 py-3 text-right font-mono font-extrabold text-indigo-650">
                      {currencyFmt(l.qty * l.unitCost)}
                    </td>

                    {/* Remove */}
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(l.id)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center border-t border-zinc-150 pt-4">
            <button
              type="button"
              onClick={addBlankNewProductLine}
              className="text-xs font-bold text-indigo-650 hover:text-indigo-800 flex items-center gap-1.5 transition"
            >
              <Plus className="h-4 w-4" /> Add Custom Product Line
            </button>
            <div className="text-base font-extrabold text-zinc-900">
              Total Order Amount: <span className="text-indigo-650 font-mono pl-1">{currencyFmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Form Actions Footer */}
        <div className="flex justify-end gap-3">
          <Link
            href="/purchases"
            className="px-5 py-2.5 rounded-xl border border-zinc-300/80 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-650 hover:bg-indigo-750 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/10 transition disabled:opacity-50 flex items-center gap-2 active:scale-98"
          >
            <Plus className="h-4 w-4" /> {submitting ? "Saving & Adding to Stock..." : "Save Purchase & Update Stock"}
          </button>
        </div>
      </form>

      {/* Datalists */}
      <datalist id="category-suggestions">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="brand-suggestions">
        {brands.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      {/* Quick Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-650">
                  <PackagePlus className="h-5 w-5" />
                </div>
                <h3 className="font-extrabold text-zinc-900 text-base">Register New Product</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterModalSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Wireless Mouse M185"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-300/80 px-3.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    SKU (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-300/80 px-3.5 font-mono text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="e.g. Electronics"
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-300/80 px-3.5 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Brand (Optional)
                  </label>
                  <input
                    type="text"
                    list="brand-suggestions"
                    placeholder="e.g. Logitech"
                    value={newProductBrand}
                    onChange={(e) => setNewProductBrand(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-300/80 px-3.5 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Receiving Quantity *
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={newProductQty}
                    onChange={(e) => setNewProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10 w-full rounded-xl border border-zinc-300/80 px-3.5 font-mono text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-zinc-50/80 p-3.5 rounded-xl border border-zinc-200/80">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Unit Cost (Cost Price) *
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={newProductCost}
                    onChange={(e) =>
                      setNewProductCost(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="h-10 w-full rounded-xl border border-zinc-300 px-3 font-mono text-sm font-bold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Selling Price (Unit Price)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={
                      typeof newProductCost === "number"
                        ? `Suggested: ${(newProductCost * 1.3).toFixed(2)}`
                        : "0.00"
                    }
                    value={newProductPrice}
                    onChange={(e) =>
                      setNewProductPrice(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="h-10 w-full rounded-xl border border-zinc-300 px-3 font-mono text-sm font-bold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-150">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-98"
                >
                  Add Product to Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
