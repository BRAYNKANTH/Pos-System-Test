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
  Calendar,
  Clock,
  CheckCircle2,
  Receipt,
  Store,
} from "lucide-react";
import { AppSidebar } from "./AppSidebar";

interface TodayTransaction {
  id: string;
  total: number;
  subtotal: number;
  paymentMethod: string;
  status: string;
  cashierName: string;
  customerName: string;
  time: string;
}

interface DashboardClientProps {
  user: {
    name: string;
    role: string;
  };
  stats: {
    todaySales: number;
    todayNetRevenue: number;
    todayOrderCount: number;
    todayPurchase: number;

    allTimeSales: number;
    allTimeNetRevenue: number;
    allTimePurchase: number;

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
    customerName: string;
    total: number;
  }[];
  todayTransactions?: TodayTransaction[];
}

const fmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DashboardClient({
  user,
  stats,
  unpaidTransactions,
  todayTransactions = [],
}: DashboardClientProps) {
  const router = useRouter();

  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Date Range Filter: "today" (Daily Review default) vs "all_time"
  const [dateRange, setDateRange] = useState<"today" | "all_time">("today");

  // Compute current date display. Deliberately an effect, not computed
  // directly during render: `new Date()` is impure and this page is
  // server-rendered, so calling it during the shared server/client render
  // would print whatever date the server happened to render at (and could
  // mismatch the client's clock) instead of "today" as the client sees it.
  const [currentDate, setCurrentDate] = useState("06-08-2026");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentDate(new Date().toLocaleDateString("en-GB").replace(/\//g, "-"));
  }, []);

  // Fetch Business Info once
  const [businessName, setBusinessName] = useState("");
  useEffect(() => {
    fetch("/api/business-info")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.bizName) setBusinessName(res.data.bizName);
      })
      .catch(() => {});
  }, []);

  // Selected active metrics based on dateRange toggle
  const activeSales = dateRange === "today" ? stats.todaySales : stats.allTimeSales;
  const activeNetRevenue = dateRange === "today" ? stats.todayNetRevenue : stats.allTimeNetRevenue;
  const activePurchases = dateRange === "today" ? stats.todayPurchase : stats.allTimePurchase;

  return (
    <div className="min-h-screen bg-zinc-150 text-zinc-900 flex relative">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-zinc-200 hidden lg:flex flex-col justify-between shrink-0">
        <AppSidebar onNavigate={() => setMobileMenuOpen(false)} user={user} initialBizName={businessName} />
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-64 max-w-xs flex-1 flex flex-col bg-white border-r shadow-2xl">
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

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-indigo-900 text-white px-5 flex items-center justify-between border-b shadow-sm shrink-0">
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
              <span className="bg-white/10 px-2.5 py-1 rounded text-white text-xs">
                {businessName || "Main Register Store"}
              </span>
            </div>

            <div className="bg-white/10 px-2.5 py-1 rounded text-white text-xs font-bold font-mono flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-indigo-300" />
              {currentDate}
            </div>
          </div>

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
              aria-label="Open POS terminal"
              className="h-8 w-8 hover:bg-white/10 rounded flex items-center justify-center text-zinc-300 hover:text-white transition"
            >
              <Calculator className="h-4.5 w-4.5" />
            </Link>

            <Link
              href="/pos"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Grid className="h-4 w-4" />
              POS Terminal
            </Link>

            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs font-semibold text-zinc-300 hidden sm:inline">{user.name}</span>
              <div className="h-8 w-8 rounded-full bg-indigo-750 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                <User className="h-4 w-4" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Body Content */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Daily Review Header & Filter Controls */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Daily Review Active
                </span>
                <span className="text-xs text-zinc-400 font-mono">{currentDate}</span>
              </div>
              <h1 className="text-xl font-extrabold text-zinc-900 mt-1">
                {dateRange === "today" ? "Today's Sales & Daily Terminal Review" : "Cumulative Business Performance"}
              </h1>
            </div>

            {/* Date Range Selector Buttons */}
            <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200/80">
              <button
                type="button"
                onClick={() => setDateRange("today")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                  dateRange === "today"
                    ? "bg-white text-indigo-650 shadow-xs border border-zinc-200"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Today (Daily Review)
              </button>
              <button
                type="button"
                onClick={() => setDateRange("all_time")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                  dateRange === "all_time"
                    ? "bg-white text-indigo-650 shadow-xs border border-zinc-200"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                All Time Cumulative
              </button>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/pos"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl p-5 flex items-center justify-between shadow-xs transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-white/10 flex items-center justify-center">
                  <ShoppingCart className="h-5.5 w-5.5" />
                </div>
                <span className="font-bold text-sm">Add Sale (POS)</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 opacity-70" />
            </Link>

            <Link
              href="/purchases/add"
              className="bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl p-5 flex items-center justify-between shadow-xs transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-white/10 flex items-center justify-center">
                  <Download className="h-5.5 w-5.5" />
                </div>
                <span className="font-bold text-sm">Add Purchase Order</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 opacity-70" />
            </Link>

            <Link
              href="/inventory"
              className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl p-5 flex items-center justify-between shadow-xs transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-white/10 flex items-center justify-center">
                  <Package className="h-5.5 w-5.5" />
                </div>
                <span className="font-bold text-sm">Products Catalog</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 opacity-70" />
            </Link>

            <Link
              href="/reports/profit-loss"
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl p-5 flex items-center justify-between shadow-xs transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-white/10 flex items-center justify-center">
                  <FileText className="h-5.5 w-5.5" />
                </div>
                <span className="font-bold text-sm">Profit / Loss Report</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 opacity-70" />
            </Link>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sales */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {dateRange === "today" ? "Today's Sales" : "Total Sales"}
                </p>
                <p className="text-xl font-extrabold font-mono mt-0.5 text-zinc-900">{fmt(activeSales)}</p>
                {dateRange === "today" && (
                  <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                    {stats.todayOrderCount} orders completed today
                  </p>
                )}
              </div>
            </div>

            {/* Net Revenue */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {dateRange === "today" ? "Today's Net Revenue" : "Net Revenue"}
                </p>
                <p className="text-xl font-extrabold font-mono mt-0.5 text-zinc-900">{fmt(activeNetRevenue)}</p>
                <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Before taxes &amp; shipping</p>
              </div>
            </div>

            {/* Total Purchases */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <Download className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {dateRange === "today" ? "Today's Purchases" : "Total Purchases"}
                </p>
                <p className="text-xl font-extrabold font-mono mt-0.5 text-zinc-900">{fmt(activePurchases)}</p>
                <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Supplier goods received</p>
              </div>
            </div>

            {/* Invoice Due */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex items-center gap-4.5 shadow-xs">
              <div className="h-14 w-14 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Invoice Due</p>
                <p className="text-xl font-extrabold font-mono mt-0.5 text-zinc-900">{fmt(stats.invoiceDue)}</p>
                <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Unpaid customer balances</p>
              </div>
            </div>
          </div>

          {/* Today's Transactions Daily Review Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-zinc-150 bg-zinc-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-650" />
                <div>
                  <h3 className="font-extrabold text-sm text-zinc-900">
                    Today&apos;s Sales Log ({currentDate})
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Sales completed during today&apos;s register shifts.
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-150">
                {todayTransactions.length} Sales Registered Today
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Cashier</th>
                    <th className="px-4 py-3">Payment Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/70 text-sm">
                  {todayTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Clock className="h-7 w-7 text-zinc-300" />
                          <p className="font-semibold text-zinc-600">No sales recorded yet today.</p>
                          <p className="text-xs text-zinc-400">
                            Open the POS Terminal to start processing today&apos;s transactions.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    todayTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-indigo-50/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-zinc-500 font-medium">{tx.time}</td>
                        <td className="px-4 py-3 font-mono font-bold text-indigo-650">{tx.id}</td>
                        <td className="px-4 py-3 font-bold text-zinc-800">{tx.customerName}</td>
                        <td className="px-4 py-3 text-zinc-600">{tx.cashierName}</td>
                        <td className="px-4 py-3 text-zinc-600 capitalize font-medium">
                          {tx.paymentMethod.replace("_", " ")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-extrabold text-indigo-650">
                          {fmt(tx.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/pos/receipt/${tx.id}`}
                            className="text-xs font-bold text-indigo-650 hover:text-indigo-800 hover:underline"
                          >
                            View Receipt &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Due Accounts Tables Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Due */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b border-zinc-150 pb-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-sm text-zinc-800">Unpaid Customer Invoices Due</h3>
              </div>

              <div className="overflow-x-auto flex-1 border border-zinc-150 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase border-b text-xs">
                    <tr>
                      <th className="px-4 py-2.5">Customer</th>
                      <th className="px-4 py-2.5">Invoice ID</th>
                      <th className="px-4 py-2.5 text-right">Due Amount</th>
                      <th className="px-4 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-zinc-150">
                    {unpaidTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-zinc-450">
                          No unpaid customer invoices.
                        </td>
                      </tr>
                    ) : (
                      unpaidTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-bold text-zinc-800">{tx.customerName}</td>
                          <td className="px-4 py-3 font-mono text-zinc-600">{tx.id}</td>
                          <td className="px-4 py-3 font-mono text-amber-600 font-extrabold text-right">
                            {fmt(tx.total)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link
                              href={`/pos/receipt/${tx.id}`}
                              className="text-indigo-650 hover:underline font-bold text-xs"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchase Due */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b border-zinc-150 pb-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-sm text-zinc-800">Purchase Payment Accounts Due</h3>
              </div>

              <div className="overflow-x-auto flex-1 border border-zinc-150 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase border-b text-xs">
                    <tr>
                      <th className="px-4 py-2.5">Supplier</th>
                      <th className="px-4 py-2.5">Reference No</th>
                      <th className="px-4 py-2.5 text-right">Due Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-zinc-450">
                        No pending purchase dues recorded.
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
