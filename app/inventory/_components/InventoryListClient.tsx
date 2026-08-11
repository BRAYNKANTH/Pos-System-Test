"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Home as HomeIcon,
  Users,
  Contact,
  Package,
  ShoppingCart,
  TrendingUp,
  FolderOpen,
  FileText,
  Settings,
  DollarSign,
  AlertTriangle,
  Grid,
  Tag,
  History,
  Calculator,
  Bell,
  User,
  Download,
  Plus,
  ChevronDown,
  RefreshCw,
  Search,
  Eye,
  Edit,
  Trash2,
  Copy,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  Printer,
  ChevronUp,
  FileDown,
  Menu
} from "lucide-react";

interface InventoryItem {
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  unitPrice: number;
  purchasePrice: number;
  qtyOnHand: number;
  lowStockThreshold: number;
}

interface StockAdjustmentLog {
  id: string;
  sku: string;
  qtyChange: number;
  type: string;
  reasonCategory: string;
  status: string;
  createdAt: string;
}

interface InventoryListClientProps {
  initialItems: InventoryItem[];
  categories: (string | null)[];
  brands: (string | null)[];
}

export default function InventoryListClient({
  initialItems,
  categories,
  brands,
}: InventoryListClientProps) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  
  // Filter settings
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterType, setFilterType] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterUnit, setFilterUnit] = useState("All");
  const [filterTax, setFilterTax] = useState("All");
  const [filterBrand, setFilterBrand] = useState("All");
  const [filterLocation, setFilterLocation] = useState("All");
  const [notForSelling, setNotForSelling] = useState(false);

  // Search, tabs and display configurations
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [activeTab, setActiveTab] = useState("all-products");

  // Floating menus and modals
  const [activeActionsSku, setActiveActionsSku] = useState<string | null>(null);
  const [editingStockItem, setEditingStockItem] = useState<InventoryItem | null>(null);
  const [newStockQty, setNewStockQty] = useState("");
  const [adjustingStock, setAdjustingStock] = useState(false);

  // Receive Stock modal — adds to the current qty (goods received from a
  // supplier / ad-hoc restock), as opposed to "Add or edit stock" above
  // which overwrites the count as a correction. Calls the goods-receipt
  // endpoint, which was previously wired to no UI at all.
  const [receivingItem, setReceivingItem] = useState<InventoryItem | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [receivingStock, setReceivingStock] = useState(false);

  // Stock history log modal
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<StockAdjustmentLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Print barcode label modal
  const [labelItem, setLabelItem] = useState<InventoryItem | null>(null);
  const [labelPrintCount, setLabelPrintCount] = useState("10");

  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const triggerAlert = (type: "success" | "error", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveActionsSku(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Check for addStockSku query parameter in URL to auto-open stock editor
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const addStockSku = urlParams.get("addStockSku");
    if (addStockSku) {
      const foundItem = items.find(i => i.sku === addStockSku);
      if (foundItem) {
        setEditingStockItem(foundItem);
        setNewStockQty(foundItem.qtyOnHand.toString());
      }
    }
  }, [items]);

  const fmtPrice = (val: number) => `Rs ${val.toFixed(2)}`;

  // Filter & Search computation logic
  const filteredItems = items.filter((item) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      if (!matchName && !matchSku) return false;
    }

    // Dropdown filters
    if (filterCategory !== "All" && item.category !== filterCategory) return false;
    if (filterBrand !== "All" && item.brand !== filterBrand) return false;

    // Simulate Location & Tax filter
    if (filterTax !== "All" && filterTax === "VAT8") return false; // None has tax
    if (filterType !== "All" && filterType !== "Single") return false; // All are single products

    // Low stock filter (Stock Report tab)
    if (activeTab === "stock-report") {
      const isLowStock = item.qtyOnHand <= item.lowStockThreshold;
      if (!isLowStock) return false;
    }

    return true;
  });

  // Action: Delete product
  const handleDeleteProduct = async (sku: string, name: string) => {
    if (!confirm(`Are you sure you want to delete product "${name}" (${sku})?`)) return;

    try {
      const res = await fetch(`/api/inventory/${sku}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to delete product.");
      }

      triggerAlert("success", `Product "${name}" deleted successfully.`);
      setItems(items.filter((item) => item.sku !== sku));
    } catch (err: any) {
      triggerAlert("error", err.message || "An error occurred.");
    }
  };

  // Action: Duplicate/Clone product
  const handleDuplicateProduct = async (item: InventoryItem) => {
    const newSku = `${item.sku}-COPY-${Math.floor(100 + Math.random() * 900)}`;
    const newName = `${item.name} (Copy)`;

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          sku: newSku,
          category: item.category,
          brand: item.brand,
          unitPrice: item.unitPrice,
          qtyOnHand: 0,
          lowStockThreshold: item.lowStockThreshold,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to duplicate product.");
      }

      setItems([...items, { ...item, sku: newSku, name: newName, qtyOnHand: 0 }]);
      triggerAlert("success", `Product duplicated successfully as "${newName}"!`);
    } catch (err: any) {
      triggerAlert("error", err.message || "Failed to duplicate product.");
    }
  };

  // Action: Fetch stock adjustment history
  const handleViewStockHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    setHistoryLogs([]);

    try {
      const res = await fetch("/api/reports/audit");
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        // Filter adjustments matching this sku
        const logs = data.data.filter((log: any) => log.sku === item.sku);
        setHistoryLogs(logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Action: Submit stock adjustment
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStockItem) return;

    const qty = parseInt(newStockQty);
    if (isNaN(qty) || qty < 0) {
      alert("Please enter a valid stock level (0 or greater).");
      return;
    }

    const delta = qty - editingStockItem.qtyOnHand;
    if (delta === 0) {
      setEditingStockItem(null);
      return;
    }

    setAdjustingStock(true);
    try {
      const res = await fetch(`/api/inventory/${editingStockItem.sku}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qtyChange: delta,
          type: "manual",
          reasonCategory: "opening_stock",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to adjust stock.");
      }

      setItems(
        items.map((item) =>
          item.sku === editingStockItem.sku ? { ...item, qtyOnHand: qty } : item
        )
      );
      triggerAlert("success", `Stock for "${editingStockItem.name}" updated to ${qty}.`);
      setEditingStockItem(null);
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setAdjustingStock(false);
    }
  };

  // Action: Receive stock (goods in) — adds to the current qty rather
  // than overwriting it.
  const handleReceiveStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingItem) return;

    const qty = parseInt(receiveQty);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a quantity greater than 0.");
      return;
    }

    setReceivingStock(true);
    try {
      const res = await fetch("/api/inventory/goods-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: receivingItem.sku, qty }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to receive stock.");
      }

      setItems(
        items.map((item) =>
          item.sku === receivingItem.sku ? { ...item, qtyOnHand: item.qtyOnHand + qty } : item
        )
      );
      triggerAlert("success", `Received ${qty} units of "${receivingItem.name}".`);
      setReceivingItem(null);
      setReceiveQty("");
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setReceivingStock(false);
    }
  };

  // CSV Export helper
  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      triggerAlert("error", "No data to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "SKU,Product Name,Category,Brand,Selling Price,Stock\n";

    filteredItems.forEach((item) => {
      const row = `"${item.sku}","${item.name.replace(/"/g, '""')}","${item.category || ""}","${item.brand || ""}",${item.unitPrice},${item.qtyOnHand}`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerAlert("success", "CSV downloaded successfully!");
  };

  const handlePrintTable = () => {
    window.print();
  };


  return (
    <>
    <div className="p-6 space-y-6 print:p-0">

      {/* Products Page Content */}

        {/* Main Products List body */}
          
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h1 className="text-xl font-bold text-zinc-800 tracking-tight">Products</h1>
              <p className="text-xs text-zinc-450 mt-0.5">Manage your products</p>
            </div>
          </div>

          {/* Alert Banners */}
          {alertMsg && (
            <div className={`p-3.5 rounded-lg text-xs font-bold border flex items-center gap-2 shadow-xs print:hidden ${
              alertMsg.type === "success" ? "bg-green-55 border-green-650 text-green-800 bg-green-50" : "bg-red-50 border-red-200 text-red-700"
            }`}>
              <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
              <span>{alertMsg.text}</span>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* CARD 1: Filters drawer accordion */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <details className="bg-white rounded-lg border border-zinc-200 shadow-xs overflow-hidden group print:hidden" open={filtersOpen} onToggle={(e) => setFiltersOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="px-5 py-3.5 flex items-center justify-between bg-zinc-50 border-b border-zinc-150 text-sm font-bold text-zinc-700 cursor-pointer list-none select-none">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-indigo-650" />
                <span>Filters</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-400" />
            </summary>
            
            <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Product Type:</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="All">All</option>
                  <option value="Single">Single</option>
                  <option value="Variable">Variable</option>
                  <option value="Combo">Combo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Category:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="All">All</option>
                  {categories.map((c) => c && <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Unit:</label>
                <select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="All">All</option>
                  <option value="Pieces">Pieces</option>
                  <option value="KG">KG</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Tax:</label>
                <select
                  value={filterTax}
                  onChange={(e) => setFilterTax(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="All">All</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Brand:</label>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="All">All</option>
                  {brands.map((b) => b && <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Business Location:</label>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="All">All</option>
                  <option value="Mektas Supers">Mektas Supers</option>
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-6">
                <input
                  type="checkbox"
                  id="nfs"
                  checked={notForSelling}
                  onChange={(e) => setNotForSelling(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-zinc-300 text-indigo-655 cursor-pointer"
                />
                <label htmlFor="nfs" className="text-xs font-bold text-zinc-700 cursor-pointer">Not for selling</label>
              </div>
            </div>
          </details>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* TAB WRAPPER & MAIN PRODUCTS TABLE CARD */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xs flex flex-col print:border-0 print:shadow-none">
            
            {/* Tab header buttons */}
            <div className="flex border-b border-zinc-200 px-4 bg-zinc-50 select-none print:hidden">
              <button
                onClick={() => setActiveTab("all-products")}
                className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
                  activeTab === "all-products" ? "border-indigo-600 text-indigo-650 bg-white" : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <Package className="h-4.5 w-4.5" />
                <span>All Products</span>
              </button>
              <button
                onClick={() => setActiveTab("stock-report")}
                className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
                  activeTab === "stock-report" ? "border-indigo-600 text-indigo-650 bg-white" : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <AlertTriangle className="h-4.5 w-4.5" />
                <span>Stock Report</span>
              </button>
            </div>

            {/* Actions toolbar */}
            <div className="p-5 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-150 print:hidden">
              
              {/* Show entries selector */}
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value))}
                  className="h-8 border border-zinc-300 rounded px-1.5 bg-white text-zinc-750"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>entries</span>
              </div>

              {/* Middle Export Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button onClick={handleExportCSV} className="border border-zinc-300 rounded px-2.5 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-50 transition flex items-center gap-1">
                  <FileDown className="h-3 w-3" /> Export CSV
                </button>
                <button onClick={handleExportCSV} className="border border-zinc-300 rounded px-2.5 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-50 transition flex items-center gap-1">
                  <FileSpreadsheet className="h-3 w-3" /> Export Excel
                </button>
                <button onClick={handlePrintTable} className="border border-zinc-300 rounded px-2.5 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-50 transition flex items-center gap-1">
                  <Printer className="h-3 w-3" /> Print
                </button>
                <button onClick={handleExportCSV} className="border border-zinc-300 rounded px-2.5 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-50 transition flex items-center gap-1">
                  <FileDown className="h-3 w-3" /> Export PDF
                </button>
              </div>

              {/* Right Action buttons */}
              <div className="flex items-center gap-3">
                <Link
                  href="/inventory/add-product"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Link>

                <button
                  onClick={handleExportCSV}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-650 border border-indigo-200 px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
                >
                  <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
                  Download Excel
                </button>

                {/* Search field */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8.5 rounded border border-zinc-300 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 bg-white w-48"
                  />
                </div>
              </div>

            </div>

            {/* Table layout */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-sm text-left min-w-[1000px] print:min-w-full">
                <thead className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200 select-none print:bg-white print:text-black">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center print:hidden"><input type="checkbox" className="rounded text-indigo-655" /></th>
                    <th className="px-3 py-3 w-16 text-center print:hidden">Product image</th>
                    <th className="px-4 py-3 w-24 print:hidden">Action</th>
                    <th className="px-4 py-3 min-w-[180px]">Product</th>
                    <th className="px-4 py-3">Business Location</th>
                    <th className="px-4 py-3 text-right">Unit Purchase Price</th>
                    <th className="px-4 py-3 text-right">Selling Price</th>
                    <th className="px-4 py-3 text-center">Current stock</th>
                    <th className="px-4 py-3 text-center">Product Type</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Tax</th>
                    <th className="px-4 py-3 font-mono">SKU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-16 text-center text-zinc-400 font-medium">
                        No data available in table
                      </td>
                    </tr>
                  ) : (
                    filteredItems.slice(0, pageSize).map((item) => {
                      const isLow = item.qtyOnHand <= item.lowStockThreshold;
                      const purchasePrice = item.purchasePrice || item.unitPrice * 0.8;
                      
                      return (
                        <tr key={item.sku} className="hover:bg-zinc-50/50 transition">
                          <td className="px-4 py-3 text-center print:hidden"><input type="checkbox" className="rounded text-indigo-650" /></td>
                          <td className="px-3 py-3 print:hidden">
                            <div className="h-10 w-10 border border-zinc-200 rounded bg-zinc-50 flex items-center justify-center text-zinc-300">
                              <Package className="h-4.5 w-4.5" />
                            </div>
                          </td>
                          <td className="px-4 py-3 relative print:hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionsSku(activeActionsSku === item.sku ? null : item.sku);
                              }}
                              className="bg-blue-50 border border-blue-200 text-blue-655 hover:bg-blue-100 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition"
                            >
                              <span>Actions</span>
                              <ChevronDown className="h-3 w-3" />
                            </button>

                            {/* Floating Actions Menu */}
                            {activeActionsSku === item.sku && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute left-4 mt-1 z-30 w-48 bg-white border border-zinc-200 rounded-md shadow-lg py-1.5 text-xs text-zinc-650 flex flex-col font-medium"
                              >
                                <button onClick={() => setLabelItem(item)} className="px-4 py-1.5 text-left hover:bg-zinc-50 flex items-center gap-2">
                                  <Tag className="h-3.5 w-3.5 text-zinc-400" /> Label Tags
                                </button>
                                <Link href={`/inventory/${item.sku}`} className="px-4 py-1.5 text-left hover:bg-zinc-50 flex items-center gap-2">
                                  <Eye className="h-3.5 w-3.5 text-zinc-400" /> View details
                                </Link>
                                <Link href={`/inventory/add-product`} className="px-4 py-1.5 text-left hover:bg-zinc-50 flex items-center gap-2">
                                  <Edit className="h-3.5 w-3.5 text-zinc-400" /> Edit Product
                                </Link>
                                <button
                                  onClick={() => handleDeleteProduct(item.sku, item.name)}
                                  className="px-4 py-1.5 text-left hover:bg-zinc-50 text-red-650 flex items-center gap-2"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" /> Delete
                                </button>
                                <span className="h-px bg-zinc-150 my-1"></span>
                                <button
                                  onClick={() => {
                                    setReceivingItem(item);
                                    setReceiveQty("");
                                    setActiveActionsSku(null);
                                  }}
                                  className="px-4 py-1.5 text-left hover:bg-zinc-50 flex items-center gap-2"
                                >
                                  <Plus className="h-3.5 w-3.5 text-green-500" /> Receive Stock
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingStockItem(item);
                                    setNewStockQty(item.qtyOnHand.toString());
                                    setActiveActionsSku(null);
                                  }}
                                  className="px-4 py-1.5 text-left hover:bg-zinc-50 flex items-center gap-2"
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" /> Add or edit stock
                                </button>
                                <button
                                  onClick={() => handleViewStockHistory(item)}
                                  className="px-4 py-1.5 text-left hover:bg-zinc-50 flex items-center gap-2"
                                >
                                  <History className="h-3.5 w-3.5 text-zinc-400" /> Stock History
                                </button>
                                <button
                                  onClick={() => handleDuplicateProduct(item)}
                                  className="px-4 py-1.5 text-left hover:bg-zinc-50 flex items-center gap-2"
                                >
                                  <Copy className="h-3.5 w-3.5 text-zinc-400" /> Duplicate Product
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-zinc-800 leading-tight">{item.name}</p>
                          </td>
                          <td className="px-4 py-3"><span className="text-zinc-505 font-semibold">Mektas Supers</span></td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-650">{fmtPrice(purchasePrice)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">{fmtPrice(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              isLow ? "bg-red-50 text-red-700 animate-pulse" : "bg-green-50 text-green-700"
                            }`}>
                              {item.qtyOnHand} Pieces
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center"><span className="text-zinc-500 font-bold uppercase text-[11px]">Single</span></td>
                          <td className="px-4 py-3"><span className="text-zinc-650 font-semibold">{item.category || "General"}</span></td>
                          <td className="px-4 py-3"><span className="text-zinc-650 font-semibold">{item.brand || "-"}</span></td>
                          <td className="px-4 py-3"><span className="text-zinc-500">None</span></td>
                          <td className="px-4 py-3 font-mono text-zinc-500">{item.sku}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* DIALOG MODAL: Edit stock levels */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {editingStockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">Add / Edit Opening Stock</h3>
              <button onClick={() => setEditingStockItem(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStockSubmit} className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Product: <span className="font-bold text-zinc-700">{editingStockItem.name}</span></p>
                <p className="text-xs text-zinc-500">Current Qty: <span className="font-bold text-zinc-700">{editingStockItem.qtyOnHand}</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1.5 uppercase">New Stock Count (Pieces):</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newStockQty}
                  onChange={(e) => setNewStockQty(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStockItem(null)}
                  className="px-3.5 py-1.5 rounded border text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustingStock}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {adjustingStock ? "Saving..." : "Save Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* DIALOG MODAL: Receive stock (goods in) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {receivingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">Receive Stock</h3>
              <button onClick={() => setReceivingItem(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleReceiveStockSubmit} className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Product: <span className="font-bold text-zinc-700">{receivingItem.name}</span></p>
                <p className="text-xs text-zinc-500">Current Qty: <span className="font-bold text-zinc-700">{receivingItem.qtyOnHand}</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1.5 uppercase">Quantity Received:</label>
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 bg-white"
                />
                {receiveQty && !isNaN(parseInt(receiveQty)) && (
                  <p className="text-xs text-zinc-450 mt-1">
                    New total: <span className="font-bold text-green-650">{receivingItem.qtyOnHand + parseInt(receiveQty)}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setReceivingItem(null)}
                  className="px-3.5 py-1.5 rounded border text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receivingStock}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {receivingStock ? "Saving..." : "Receive Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* DIALOG MODAL: View Stock Audit history */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">Stock Adjustment Audit Log</h3>
              <button onClick={() => setHistoryItem(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500">Product: <span className="font-bold text-zinc-700">{historyItem.name} ({historyItem.sku})</span></p>
                <p className="text-xs text-zinc-500">Current Balance: <span className="font-bold text-indigo-600">{historyItem.qtyOnHand} Units</span></p>
              </div>

              <div className="max-h-60 overflow-y-auto border border-zinc-150 rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Change</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-zinc-400">Loading audit history...</td>
                      </tr>
                    ) : historyLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-zinc-400">No stock adjustment entries found for this product.</td>
                      </tr>
                    ) : (
                      historyLogs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-zinc-50/50">
                          <td className="px-3 py-2 text-zinc-500">{new Date(log.createdAt).toLocaleString("en-LK")}</td>
                          <td className="px-3 py-2 capitalize font-semibold">{log.type}</td>
                          <td className={`px-3 py-2 font-mono font-bold ${log.qtyChange >= 0 ? "text-green-600" : "text-red-650"}`}>
                            {log.qtyChange >= 0 ? `+${log.qtyChange}` : log.qtyChange}
                          </td>
                          <td className="px-3 py-2 capitalize">{log.reasonCategory.replace(/_/g, " ")}</td>
                          <td className="px-3 py-2">
                            <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-xs font-bold capitalize">{log.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end border-t pt-3">
              <button
                onClick={() => setHistoryItem(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded text-xs font-bold shadow-sm transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* DIALOG MODAL: Barcode Print labels tags preview */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {labelItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">Print Product Labels</h3>
              <button onClick={() => setLabelItem(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Product: <span className="font-bold text-zinc-700">{labelItem.name}</span></p>
                <p className="text-xs text-zinc-500">Price: <span className="font-bold text-indigo-600">{fmtPrice(labelItem.unitPrice)}</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1.5">Number of labels to print:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={labelPrintCount}
                  onChange={(e) => setLabelPrintCount(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              {/* Barcode Mock Preview */}
              <div className="border rounded bg-zinc-50 p-4 flex flex-col items-center justify-center select-none text-center">
                <p className="text-xs font-bold text-zinc-700 tracking-wider uppercase mb-1">{labelItem.name}</p>
                <p className="text-xs font-mono font-bold text-zinc-800 mb-2">{fmtPrice(labelItem.unitPrice)}</p>
                
                {/* Visual barcode mock lines */}
                <div className="h-10 flex gap-0.5 bg-white px-4 py-1.5 border border-zinc-200 items-stretch">
                  {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 2, 1, 4, 2, 1].map((w, idx) => (
                    <span key={idx} className="bg-black shrink-0" style={{ width: `${w}px` }}></span>
                  ))}
                </div>
                
                <p className="text-[11px] font-mono text-zinc-400 mt-1.5">{labelItem.sku}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setLabelItem(null)}
                className="px-3.5 py-1.5 rounded border text-xs font-semibold text-zinc-650 hover:bg-zinc-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                  setLabelItem(null);
                }}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold shadow-sm transition flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Print {labelPrintCount} Labels
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
