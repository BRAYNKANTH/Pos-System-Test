"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Info,
  Calendar,
  AlertTriangle,
  Check,
} from "lucide-react";

interface DBProduct {
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
}

interface DiscountItem {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  discountType: string;
  discountAmount: number;
  priority: number;
  brand: string;
  category: string;
  products: DBProduct[];
  location: string;
  sellingPriceGroup: string;
  applyInCustomerGroups: boolean;
  isActive: boolean;
}

interface DiscountsClientProps {
  products: DBProduct[];
  initialDiscounts: DiscountItem[];
}

export default function DiscountsClient({ products, initialDiscounts }: DiscountsClientProps) {
  // States
  const [discounts, setDiscounts] = useState<DiscountItem[]>(initialDiscounts);
  const [searchQuery, setSearchQuery] = useState("");
  const [entriesCount, setEntriesCount] = useState(25);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DiscountItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formProducts, setFormProducts] = useState<DBProduct[]>([]);
  const [formBrand, setFormBrand] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formLocation, setFormLocation] = useState("Mektas Supers");
  const [formPriority, setFormPriority] = useState("1");
  const [formDiscountType, setFormDiscountType] = useState("Percentage");
  const [formDiscountAmount, setFormDiscountAmount] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formPriceGroup, setFormPriceGroup] = useState("All");
  const [formApplyCustomer, setFormApplyCustomer] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Product Autocomplete state in Modal
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);


  // Helper formats
  const formatDate = (isoStr: string) => {
    if (!isoStr) return "";
    const date = new Date(isoStr);
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    const hr = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${d}-${m}-${y} ${hr}:${min}`;
  };

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
  }, [products]);

  const brands = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[];
  }, [products]);

  // Autocomplete products
  const suggestedProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
          !formProducts.some((fp) => fp.sku === p.sku)
      )
      .slice(0, 10);
  }, [productSearch, products, formProducts]);

  // Filtered discounts
  const filteredDiscounts = useMemo(() => {
    let list = discounts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.location.toLowerCase().includes(q) ||
          d.products.some(
            (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
          )
      );
    }
    return list.slice(0, entriesCount);
  }, [discounts, searchQuery, entriesCount]);

  // Open modal for adding
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName("");
    setFormProducts([]);
    setFormBrand("");
    setFormCategory("");
    setFormLocation("Mektas Supers");
    setFormPriority("1");
    setFormDiscountType("Percentage");
    setFormDiscountAmount("");
    const now = new Date();
    const later = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setFormStartsAt(now.toISOString().slice(0, 16));
    setFormEndsAt(later.toISOString().slice(0, 16));
    setFormPriceGroup("All");
    setFormApplyCustomer(false);
    setFormIsActive(true);
    setProductSearch("");
    setShowProductDropdown(false);
    setModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (item: DiscountItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormProducts(item.products);
    setFormBrand(item.brand);
    setFormCategory(item.category);
    setFormLocation(item.location);
    setFormPriority(String(item.priority));
    setFormDiscountType(item.discountType);
    setFormDiscountAmount(String(item.discountAmount));
    setFormStartsAt(item.startsAt);
    setFormEndsAt(item.endsAt);
    setFormPriceGroup(item.sellingPriceGroup);
    setFormApplyCustomer(item.applyInCustomerGroups);
    setFormIsActive(item.isActive);
    setProductSearch("");
    setShowProductDropdown(false);
    setModalOpen(true);
  };

  // Delete handler
  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete discount "${name}"?`)) {
      try {
        const res = await fetch(`/api/sales/discounts/${id}`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setDiscounts(discounts.filter((d) => d.id !== id));
        } else {
          alert(data.error || "Failed to delete discount.");
        }
      } catch (err) {
        console.error(err);
        alert("An error occurred while deleting discount.");
      }
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    const next = !selectAll;
    setSelectAll(next);
    const nextSelected: Record<string, boolean> = {};
    if (next) {
      filteredDiscounts.forEach((d) => {
        nextSelected[d.id] = true;
      });
    }
    setSelectedIds(nextSelected);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const [formLoading, setFormLoading] = useState(false);

  // Form Save
  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Name is required.");
      return;
    }
    if (!formDiscountAmount) {
      alert("Discount amount is required.");
      return;
    }

    setFormLoading(true);

    try {
      const payload = {
        name: formName,
        products: formProducts,
        brand: formBrand || null,
        category: formCategory || null,
        location: formLocation,
        priority: parseInt(formPriority) || 1,
        discountType: formDiscountType,
        discountAmount: parseFloat(formDiscountAmount) || 0,
        startsAt: new Date(formStartsAt).toISOString(),
        endsAt: new Date(formEndsAt).toISOString(),
        sellingPriceGroup: formPriceGroup,
        applyInCustomerGroups: formApplyCustomer,
        isActive: formIsActive,
      };

      const url = editingItem
        ? `/api/sales/discounts/${editingItem.id}`
        : "/api/sales/discounts";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const savedItem = {
          ...data.data,
          startsAt: data.data.startsAt.slice(0, 16),
          endsAt: data.data.endsAt.slice(0, 16),
          discountAmount: Number(data.data.discountAmount)
        };

        if (editingItem) {
          setDiscounts(discounts.map((d) => d.id === editingItem.id ? savedItem : d));
        } else {
          setDiscounts([savedItem, ...discounts]);
        }
        setModalOpen(false);
      } else {
        alert(data.error || "Failed to save discount.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving discount.");
    } finally {
      setFormLoading(false);
    }
  };

  const addProductToForm = (prod: DBProduct) => {
    setFormProducts([...formProducts, prod]);
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const removeProductFromForm = (sku: string) => {
    setFormProducts(formProducts.filter((fp) => fp.sku !== sku));
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* HEADER ROW */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Discount</h1>
        </div>
      </div>

      {/* CARD & TABLE CONTAINER */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        
        {/* UPPER CARD CONTROL BAR */}
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-150">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* ENTRIES SELECT */}
            <div className="flex items-center gap-2 text-sm text-zinc-600 font-semibold">
              <span>Show</span>
              <select
                value={entriesCount}
                onChange={(e) => setEntriesCount(parseInt(e.target.value) || 25)}
                className="h-8 rounded border border-zinc-300 px-2 bg-white outline-none focus:border-indigo-500 font-bold"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>entries</span>
            </div>

            {/* EXPORT ACTION BUTTONS */}
            <div className="flex items-center flex-wrap gap-1.5 pl-2 border-l border-zinc-250">
              {["CSV", "Excel", "Print", "Column visibility", "PDF"].map((label) => (
                <button
                  key={label}
                  onClick={() => alert(`Export to ${label} completed.`)}
                  className="border border-zinc-300 rounded px-3 py-1.5 text-xs font-bold text-zinc-550 hover:bg-zinc-50 hover:text-zinc-800 transition shadow-xxs bg-white"
                >
                  Export {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* SEARCH INPUT */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-60 pl-9 pr-3 rounded border border-zinc-300 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
              />
            </div>

            {/* ADD BUTTON */}
            <button
              onClick={handleOpenAddModal}
              className="bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

        </div>

        {/* MAIN TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleToggleSelectAll}
                    className="h-3.5 w-3.5 rounded text-indigo-650 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Name</th>
                <th className="px-4 py-3.5">Starts At</th>
                <th className="px-4 py-3.5">Ends At</th>
                <th className="px-4 py-3.5">Discount Amount</th>
                <th className="px-4 py-3.5 w-20 text-center">Priority</th>
                <th className="px-4 py-3.5">Brand</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Products</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {filteredDiscounts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-zinc-400 font-medium">
                    No discount codes available.
                  </td>
                </tr>
              ) : (
                filteredDiscounts.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition">
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={!!selectedIds[item.id]}
                        onChange={() => handleToggleSelect(item.id)}
                        className="h-3.5 w-3.5 rounded text-indigo-650 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-bold text-zinc-800">{item.name}</td>
                    <td className="px-4 py-3.5 text-zinc-600 whitespace-nowrap">{formatDate(item.startsAt)}</td>
                    <td className="px-4 py-3.5 text-zinc-600 whitespace-nowrap">{formatDate(item.endsAt)}</td>
                    <td className="px-4 py-3.5 font-bold font-mono text-zinc-800">
                      {item.discountAmount.toFixed(2)}
                      {item.discountType === "Percentage" && "%"}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-zinc-700">{item.priority}</td>
                    <td className="px-4 py-3.5 text-zinc-500 font-semibold">{item.brand || "—"}</td>
                    <td className="px-4 py-3.5 text-zinc-500 font-semibold">{item.category || "—"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.products.map((p) => (
                          <span
                            key={p.sku}
                            className="bg-indigo-50 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded border border-indigo-100 whitespace-nowrap"
                          >
                            {p.name} ({p.sku})
                          </span>
                        ))}
                        {item.products.length === 0 && <span className="text-zinc-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 font-semibold">{item.location}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="border border-red-200 text-red-650 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* MODAL HEADER */}
            <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-150 flex items-center justify-between">
              <h3 className="font-extrabold text-zinc-800 text-base">
                {editingItem ? "Edit Discount" : "Add Discount"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="h-7 w-7 rounded-full hover:bg-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-650 transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* MODAL FORM */}
            <form onSubmit={handleSaveDiscount} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* NAME */}
              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Name:*
                </label>
                <input
                  type="text"
                  required
                  placeholder="Name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              {/* PRODUCTS SEARCH */}
              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Products:
                </label>
                
                {/* Search field */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by SKU or name"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />

                  {/* Dropdown suggestions */}
                  {showProductDropdown && suggestedProducts.length > 0 && (
                    <div className="absolute left-0 right-0 top-11 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 max-h-52 overflow-y-auto">
                      {suggestedProducts.map((p) => (
                        <button
                          key={p.sku}
                          type="button"
                          onClick={() => addProductToForm(p)}
                          className="w-full text-left px-4 py-2 hover:bg-zinc-50 flex items-center justify-between border-b last:border-0"
                        >
                          <span className="font-semibold text-xs text-zinc-800">{p.name}</span>
                          <span className="text-xs font-mono text-zinc-450 bg-zinc-100 px-1.5 py-0.5 rounded">{p.sku}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected products list pills */}
                {formProducts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {formProducts.map((p) => (
                      <span
                        key={p.sku}
                        className="bg-indigo-50 text-indigo-800 border border-indigo-150 rounded px-2.5 py-1 text-xs font-bold flex items-center gap-1.5"
                      >
                        {p.name} ({p.sku})
                        <button
                          type="button"
                          onClick={() => removeProductFromForm(p.sku)}
                          className="h-4 w-4 rounded-full bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-indigo-800 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* TWO-COLUMN CONFIG */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Brand */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Brand:
                  </label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-xs font-semibold bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="">Please Select</option>
                    {brands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Category:
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-xs font-semibold bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="">Please Select</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Location:*
                  </label>
                  <select
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-xs font-semibold bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="Mektas Supers">Mektas Supers</option>
                    <option value="Branch 2">Branch 2</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Priority:
                    <span title="Higher priority overrides conflicting discounts.">
                      <Info className="h-3.5 w-3.5 text-indigo-650 cursor-help" />
                    </span>
                  </label>
                  <input
                    type="number"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                {/* Discount Type */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Discount Type:*
                  </label>
                  <select
                    value={formDiscountType}
                    onChange={(e) => setFormDiscountType(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-xs font-semibold bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="Percentage">Percentage</option>
                    <option value="Fixed">Fixed Amount</option>
                  </select>
                </div>

                {/* Discount Amount */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Discount Amount:*
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="Discount Amount"
                    value={formDiscountAmount}
                    onChange={(e) => setFormDiscountAmount(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white font-mono"
                  />
                </div>

                {/* Starts At */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Starts At:
                  </label>
                  <input
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                {/* Ends At */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Ends At:
                  </label>
                  <input
                    type="datetime-local"
                    value={formEndsAt}
                    onChange={(e) => setFormEndsAt(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                {/* Selling Price Group */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Selling Price Group:
                  </label>
                  <select
                    value={formPriceGroup}
                    onChange={(e) => setFormPriceGroup(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-xs font-semibold bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="All">All</option>
                    <option value="Default Selling Price">Default Selling Price</option>
                    <option value="Retail customer group">Retail customer group</option>
                  </select>
                </div>

              </div>

              {/* CHECKBOX OPTIONS */}
              <div className="pt-2 flex flex-col gap-3">
                <label className="flex items-center gap-2 font-semibold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formApplyCustomer}
                    onChange={(e) => setFormApplyCustomer(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Apply in customer groups</span>
                </label>

                <label className="flex items-center gap-2 font-semibold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Is active</span>
                </label>
              </div>

              {/* MODAL FOOTER */}
              <div className="pt-4 border-t border-zinc-150 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-indigo-650 hover:bg-indigo-750 text-white px-6 py-2.5 rounded-lg text-xs font-extrabold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={formLoading}
                  className="bg-zinc-700 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-lg text-xs font-extrabold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Close
                </button>
              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}
