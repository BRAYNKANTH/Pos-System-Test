"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  FolderOpen,
  FileText,
  DollarSign,
  AlertTriangle,
  Grid,
  Tag,
  Calculator,
  Bell,
  User,
  Download,
  Plus,
  RefreshCw,
  Search,
  ArrowRight,
  Info,
  Menu,
  X,
  Package,
  ShoppingCart,
  History,
} from "lucide-react";
import { AppSidebar } from "./AppSidebar";

interface DashboardClientProps {
  user: {
    name: string;
    role: string;
  };
  stats: {
    totalSales: number;
    netRevenue: number;
    invoiceDue: number;
    sellReturns: number;
    totalPurchase: number;
    purchaseDue: number;
    purchaseReturns: number;
    expenses: number;
  };
  unpaidTransactions: {
    id: string;
    total: number;
  }[];
}

// fmt is a pure formatting function — defined outside the component so it
// is not re-created on every render (was previously inside the render body).
const fmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DashboardClient({
  user,
  stats,
  unpaidTransactions,
}: DashboardClientProps) {
  const router = useRouter();

  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Compute the current date on mount to avoid server-client hydration mismatches.
  const [currentDate, setCurrentDate] = useState("06-08-2026");
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString("en-GB").replace(/\//g, "-"));
  }, []);

  // Business name — fetch once on mount. The result is also passed down to
  // AppSidebar via the initialBizName prop so the sidebar never needs to
  // make its own redundant /api/admin/business-settings call.
  const [businessName, setBusinessName] = useState("Mektas Supers");
  useEffect(() => {
    fetch("/api/admin/business-settings")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.bizName) setBusinessName(res.data.bizName);
      })
      .catch(() => {});
  }, []);


  return (
    <div className="min-h-screen bg-zinc-150 text-zinc-900 flex relative">

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* DESKTOP SIDEBAR NAVIGATION */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-zinc-200 hidden lg:flex flex-col justify-between shrink-0">
        <AppSidebar onNavigate={() => setMobileMenuOpen(false)} user={user} initialBizName={businessName} />
      </aside>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* MOBILE DRAWER OVERLAY NAVIGATION */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-64 max-w-xs flex-1 flex flex-col bg-white border-r animate-slide-in shadow-2xl">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <AppSidebar onNavigate={() => setMobileMenuOpen(false)} user={user} initialBizName={businessName} />
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* MAIN VIEW CONTENT AREA */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Navbar Header */}
        <header className="h-16 bg-indigo-900 text-white px-5 flex items-center justify-between border-b shadow-sm shrink-0">
          
          {/* Left panel & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded lg:hidden text-white transition"
              title="Menu Drawer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="font-bold text-base lg:hidden">{businessName}</span>
            
            <div className="hidden lg:flex items-center gap-2 text-sm font-semibold">
              <span className="text-zinc-300">Location:</span>
              <span className="bg-white/10 px-2.5 py-1 rounded text-white text-xs">{businessName}</span>
            </div>
            
            <div className="bg-white/10 px-2.5 py-1 rounded text-white text-xs font-bold font-mono">
              {currentDate}
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            <Link
              href="/purchases/add"
              aria-label="Add new purchase"
              className="h-8 w-8 hover:bg-white/10 rounded flex items-center justify-center text-zinc-300 hover:text-white transition"
            >
              <Plus className="h-4.5 w-4.5" />
            </Link>
            <Link
              href="/pos"
              aria-label="Open POS calculator"
              className="h-8 w-8 hover:bg-white/10 rounded flex items-center justify-center text-zinc-300 hover:text-white transition"
            >
              <Calculator className="h-4.5 w-4.5" />
            </Link>

            <Link href="/pos" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
              <Grid className="h-4 w-4" />
              POS
            </Link>

            {/* Bell with no hardcoded indicator — removed the always-on red dot
                that was misleading users into thinking there are notifications
                when there aren't any. */}
            <button
              aria-label="Notifications"
              className="h-8 w-8 hover:bg-white/10 rounded flex items-center justify-center text-zinc-300 hover:text-white transition"
            >
              <Bell className="h-4.5 w-4.5" />
            </button>

            <span className="h-5 border-l border-white/20"></span>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-300 hidden sm:inline">{user.name}</span>
              <div className="h-8 w-8 rounded-full bg-indigo-750 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                <User className="h-4 w-4" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content body */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          
          {/* Quick Action Grid (4 large buttons) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/pos" className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-5 flex items-center justify-between shadow-sm transition">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded bg-white/10 flex items-center justify-center">
                  <ShoppingCart className="h-5.5 w-5.5" />
                </div>
                <span className="font-bold text-sm">Add Sale</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 opacity-70" />
            </Link>

            <Link href="/inventory/add-product" className="bg-blue-700 hover:bg-blue-800 text-white rounded-lg p-5 flex items-center justify-between shadow-sm transition">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded bg-white/10 flex items-center justify-center">
                  <Package className="h-5.5 w-5.5" />
                </div>
                <span className="font-bold text-sm">Add Product</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 opacity-70" />
            </Link>

            <Link href="/purchases/add" className="bg-red-750 hover:bg-red-800 text-white rounded-lg p-5 flex items-center justify-between shadow-sm transition">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded bg-white/10 flex items-center justify-center">
                  <Download className="h-5.5 w-5.5" />
                </div>
                <span className="font-bold text-sm">Add Purchase</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 opacity-70" />
            </Link>

            <Link href="/reports/sales" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg p-5 flex items-center justify-between shadow-sm transition">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded bg-white/10 flex items-center justify-center">
                  <FileText className="h-5.5 w-5.5" />
                </div>
                <span className="font-bold text-sm">Summary</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 opacity-70" />
            </Link>
          </div>

          {/* Stats Cards Grid (8 cards, 4 per row) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total Sales */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-400">Total Sales</p>
                <p className="text-xl font-bold font-mono mt-0.5">{fmt(stats.totalSales)}</p>
              </div>
            </div>

            {/* Net Revenue */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-400">Net Revenue</p>
                <p className="text-xl font-bold font-mono mt-0.5">{fmt(stats.netRevenue)}</p>
              </div>
            </div>

            {/* Invoice Due */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-orange-50 text-orange-650 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-400">Invoice due</p>
                <p className="text-xl font-bold font-mono mt-0.5">{fmt(stats.invoiceDue)}</p>
              </div>
            </div>

            {/* Total Sell Return */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-red-50 text-red-650 flex items-center justify-center shrink-0">
                <History className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-400">Total Sell Return</p>
                <p className="text-xl font-bold font-mono mt-0.5">{fmt(stats.sellReturns)}</p>
              </div>
            </div>

            {/* Total Purchase */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Download className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-400">Total purchase</p>
                <p className="text-xl font-bold font-mono mt-0.5">{fmt(stats.totalPurchase)}</p>
              </div>
            </div>

            {/* Purchase Due */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-400">Purchase due</p>
                <p className="text-xl font-bold font-mono mt-0.5">{fmt(stats.purchaseDue)}</p>
              </div>
            </div>

            {/* Purchase Return */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <History className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-400">Total Purchase Return</p>
                <p className="text-xl font-bold font-mono mt-0.5">{fmt(stats.purchaseReturns)}</p>
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-400">Expense</p>
                <p className="text-xl font-bold font-mono mt-0.5">{fmt(stats.expenses)}</p>
              </div>
            </div>

          </div>

          {/* Bottom Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Sales Due */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b pb-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-sm text-zinc-800">Sales Payment Due</h3>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {["CSV", "Excel", "Print", "PDF"].map((label) => (
                  <button
                    key={label}
                    disabled
                    title="Export not available on dashboard — use the Reports section for full exports."
                    className="border border-zinc-200 rounded px-2.5 py-1 text-xs font-bold text-zinc-400 bg-zinc-50 cursor-not-allowed opacity-60"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto flex-1 border border-zinc-150 rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase border-b text-xs">
                    <tr>
                      <th className="px-4 py-2.5">Customer</th>
                      <th className="px-4 py-2.5">Invoice No.</th>
                      <th className="px-4 py-2.5">Due Amount</th>
                      <th className="px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {unpaidTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-zinc-450">
                          No data available in table
                        </td>
                      </tr>
                    ) : (
                      unpaidTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-semibold text-zinc-700">Walk-In Customer</td>
                          <td className="px-4 py-3 font-mono">{tx.id}</td>
                          <td className="px-4 py-3 font-mono text-amber-600 font-bold">{fmt(tx.total)}</td>
                          <td className="px-4 py-3">
                            <Link href={`/pos/receipt/${tx.id}`} className="text-indigo-600 hover:underline font-bold text-xs">View</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchase Due */}
            <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b pb-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-sm text-zinc-800">Purchase Payment Due</h3>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {["CSV", "Excel", "Print", "PDF"].map((label) => (
                  <button
                    key={label}
                    disabled
                    title="Export not available on dashboard — use the Reports section for full exports."
                    className="border border-zinc-200 rounded px-2.5 py-1 text-xs font-bold text-zinc-400 bg-zinc-50 cursor-not-allowed opacity-60"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto flex-1 border border-zinc-150 rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase border-b text-xs">
                    <tr>
                      <th className="px-4 py-2.5">Supplier</th>
                      <th className="px-4 py-2.5">Reference No</th>
                      <th className="px-4 py-2.5">Due Amount</th>
                      <th className="px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-zinc-450">
                        No data available in table
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </main>
      </div>

    </div>
  );
}
