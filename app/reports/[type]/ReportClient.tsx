"use client";

import React, { useState, useMemo } from "react";
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  List,
  Printer,
  Calendar,
  MapPin,
  Tag,
  FolderOpen,
  Award,
  FileText,
  User,
  Users,
  CalendarDays
} from "lucide-react";

interface SummaryCard {
  label: string;
  value: string;
  desc?: string;
}

interface ChartItem {
  name: string;
  value: number;
}

interface ReportData {
  title: string;
  description: string;
  type: string;
  headers: string[];
  rows: Record<string, any>[];
  summaryCards: SummaryCard[];
  chartData: ChartItem[];
  
  plMetrics?: Record<string, number>;
  plTabsData?: Record<string, { name: string; grossProfit: number }[]>;
}

interface ReportClientProps {
  reportData: ReportData;
}

type PLTabId =
  | "products"
  | "categories"
  | "brands"
  | "locations"
  | "invoices"
  | "dates"
  | "customers"
  | "days"
  | "staff";

export default function ReportClient({ reportData }: ReportClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Profit/Loss specific state
  const [plActiveTab, setPlActiveTab] = useState<PLTabId>("products");
  const [plLocation, setPlLocation] = useState("All locations");

  const currencyFmt = (val: number) => `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- REPORT VIEW MODE ---
  const isPLReport = reportData.type === "profit-loss";

  // --- TABS DATA DEFINITION FOR P&L ---
  const plTabs: { id: PLTabId; label: string; icon: any }[] = [
    { id: "products", label: "Profit by products", icon: Tag },
    { id: "categories", label: "Profit by categories", icon: FolderOpen },
    { id: "brands", label: "Profit by brands", icon: Award },
    { id: "locations", label: "Profit by locations", icon: MapPin },
    { id: "invoices", label: "Profit by invoice", icon: FileText },
    { id: "dates", label: "Profit by date", icon: Calendar },
    { id: "customers", label: "Profit by customer", icon: User },
    { id: "days", label: "Profit by day", icon: CalendarDays },
    { id: "staff", label: "Profit by service staff", icon: Users },
  ];

  // Resolve active rows based on report type & tab selection
  const activeRows = useMemo<Record<string, any>[]>(() => {
    if (!isPLReport || !reportData.plTabsData) {
      return reportData.rows;
    }
    const rawData = reportData.plTabsData[plActiveTab] || [];
    return rawData.map((item) => ({
      columnName: item.name,
      grossProfit: currencyFmt(item.grossProfit),
    }));
  }, [isPLReport, reportData, plActiveTab]);

  // Headers mapping for P&L tabs versus standard reports
  const activeHeaders = useMemo(() => {
    if (!isPLReport) return reportData.headers;
    const tabName = plTabs.find((t) => t.id === plActiveTab)?.label || "Entity";
    // Returns e.g. ["Product", "Gross Profit"]
    const label = tabName.replace("Profit by ", "").replace(/^\w/, (c) => c.toUpperCase());
    return [label, "Gross Profit"];
  }, [isPLReport, reportData, plActiveTab]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (activeRows.length === 0) return;
    const csvHeaders = activeHeaders.join(",");
    const csvRows = activeRows.map((row) =>
      Object.keys(row)
        .map((key) => `"${String(row[key]).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [csvHeaders, ...csvRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportData.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Search & Filter
  const filteredRows = useMemo(() => {
    return activeRows.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [activeRows, searchQuery]);

  // Sort
  const sortedRows = useMemo(() => {
    if (!sortField) return filteredRows;
    const sorted = [...filteredRows].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      const aNum = parseFloat(String(aVal).replace(/[^0-9.-]+/g, ""));
      const bNum = parseFloat(String(bVal).replace(/[^0-9.-]+/g, ""));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortAsc ? aNum - bNum : bNum - aNum;
      }

      return sortAsc
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [filteredRows, sortField, sortAsc]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedRows.slice(start, start + itemsPerPage);
  }, [sortedRows, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedRows.length / itemsPerPage);

  const handleHeaderClick = (index: number) => {
    const keys = Object.keys(activeRows[0] || {});
    const field = keys[index];
    if (field) {
      if (sortField === field) {
        setSortAsc(!sortAsc);
      } else {
        setSortField(field);
        setSortAsc(true);
      }
    }
  };

  // Sum of visible table rows gross profit for P&L footer total
  const tabTotal = useMemo(() => {
    if (!isPLReport || !reportData.plTabsData) return 0;
    const rawData = reportData.plTabsData[plActiveTab] || [];
    return rawData.reduce((acc, i) => acc + i.grossProfit, 0);
  }, [isPLReport, reportData, plActiveTab]);

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // P&L Metrics metrics shortcuts
  const pl = reportData.plMetrics || {};

  // Custom visual components for Profit/Loss
  if (isPLReport) {
    return (
      <div className="p-6 space-y-6 print:p-0 print:bg-white print:text-black">
        
        {/* HEADER & FILTERS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Profit / Loss Report</h1>
            <p className="text-xs text-zinc-450 mt-1">Detailed analysis of revenue margins, stock flows, and expenses.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* LOCATION SELECTOR */}
            <div className="relative flex items-center">
              <span className="absolute left-3 text-indigo-650 z-10">
                <MapPin className="h-4 w-4" />
              </span>
              <select
                value={plLocation}
                onChange={(e) => setPlLocation(e.target.value)}
                className="h-10 pl-9 pr-8 rounded-lg border border-indigo-200 text-xs font-bold text-zinc-700 outline-none focus:border-indigo-500 bg-white cursor-pointer select-none appearance-none"
              >
                <option value="All locations">All locations</option>
                <option value="Mektas Supers">Mektas Supers</option>
              </select>
              <ChevronLeft className="-rotate-90 h-3 w-3 text-zinc-400 absolute right-3 pointer-events-none" />
            </div>

            {/* DATE FILTER BUTTON */}
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition">
              <Calendar className="h-4 w-4" /> Filter by date
            </button>
          </div>
        </div>

        {/* SIDE-BY-SIDE DOUBLE-COLUMN METRIC TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column Table */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden p-5 space-y-1.5">
            <div className="flex justify-between items-center py-2 px-3 border-b border-zinc-100 bg-zinc-50/50 rounded-t">
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Asset & Cost Flow</span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Amount</span>
            </div>

            <div className="divide-y divide-zinc-100 text-xs text-zinc-700">
              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <div className="flex flex-col">
                  <span className="font-bold">Opening Stock</span>
                  <span className="text-[11px] text-zinc-450">(By purchase price):</span>
                </div>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.openingStockPurchase || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <div className="flex flex-col">
                  <span className="font-bold">Opening Stock</span>
                  <span className="text-[11px] text-zinc-450">(By sale price):</span>
                </div>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.openingStockSale || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <div className="flex flex-col">
                  <span className="font-bold">Total purchase:</span>
                  <span className="text-[11px] text-zinc-450">(Exc. tax, Discount)</span>
                </div>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalPurchase || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total Stock Adjustment:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalStockAdjustment || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total Expense:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalExpense || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total purchase shipping charge:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalPurchaseShipping || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Purchase additional expenses:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.purchaseAdditionalExpenses || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total transfer shipping charge:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalTransferShipping || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total Sell discount:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalSellDiscount || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total customer reward:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalCustomerReward || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total Sell Return:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalSellReturn || 0)}</span>
              </div>
            </div>
          </div>

          {/* Right Column Table */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden p-5 space-y-1.5">
            <div className="flex justify-between items-center py-2 px-3 border-b border-zinc-100 bg-zinc-50/50 rounded-t">
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Retail Sales Flow</span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Amount</span>
            </div>

            <div className="divide-y divide-zinc-100 text-xs text-zinc-700">
              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <div className="flex flex-col">
                  <span className="font-bold">Closing stock</span>
                  <span className="text-[11px] text-zinc-450">(By purchase price):</span>
                </div>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.closingStockPurchase || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <div className="flex flex-col">
                  <span className="font-bold">Closing stock</span>
                  <span className="text-[11px] text-zinc-450">(By sale price):</span>
                </div>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.closingStockSale || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <div className="flex flex-col">
                  <span className="font-bold">Total Sales:</span>
                  <span className="text-[11px] text-zinc-450">(Exc. tax, Discount)</span>
                </div>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalSales || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total sell shipping charge:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalSellShipping || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Sell additional expenses:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.sellAdditionalExpenses || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total Stock Recovered:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalStockRecovered || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total Purchase Return:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalPurchaseReturn || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total Purchase discount:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalPurchaseDiscount || 0)}</span>
              </div>

              <div className="flex justify-between py-2 px-3 hover:bg-zinc-50/40">
                <span className="font-bold self-center">Total sell round off:</span>
                <span className="font-bold text-zinc-800 self-center">{currencyFmt(pl.totalSellRoundOff || 0)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* FORMULA CALCULATIONS CARDS */}
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 space-y-6">
          <div className="space-y-4">
            
            {/* COGS */}
            <div className="space-y-1 border-b border-zinc-150 pb-4">
              <h2 className="text-lg font-bold text-zinc-800">COGS: {currencyFmt(pl.cogs || 0)}</h2>
              <p className="text-xs text-zinc-450 font-semibold uppercase tracking-wide">
                Cost of Goods Sold = Starting inventory(opening stock) + purchases – ending inventory(closing stock)
              </p>
            </div>

            {/* Gross Profit */}
            <div className="space-y-1 border-b border-zinc-150 pb-4">
              <h2 className="text-lg font-bold text-zinc-800">Gross Profit: {currencyFmt(pl.grossProfit || 0)}</h2>
              <p className="text-xs text-zinc-450 font-semibold uppercase tracking-wide">
                (Total sell price - Total purchase price)
              </p>
            </div>

            {/* Net Profit */}
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-zinc-800">Net Profit: {currencyFmt(pl.netProfit || 0)}</h2>
              <p className="text-xs text-zinc-450 font-semibold uppercase tracking-wide leading-relaxed">
                Gross Profit + (Total sell shipping charge + Sell additional expenses + Total Stock Recovered + Total Purchase discount + Total sell round off ) - ( Total Stock Adjustment + Total Expense + Total purchase shipping charge + Total transfer shipping charge + Purchase additional expenses + Total Sell discount + Total customer reward )
              </p>
            </div>

          </div>
        </div>

        {/* PRINT FLOATING TRIGGER */}
        <div className="flex justify-end print:hidden">
          <button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-xs font-extrabold shadow-md transition flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>

        {/* LEDGER ACCORDIONS & GRID SYSTEM */}
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
          
          {/* TAB HEADERS GRID */}
          <div className="flex flex-wrap border-b border-zinc-200 bg-zinc-50/50 text-xs font-bold text-zinc-600 select-none print:hidden">
            {plTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = plActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setPlActiveTab(tab.id);
                    setCurrentPage(1);
                    setSortField(null);
                  }}
                  className={`px-4 py-3 flex items-center gap-1.5 transition-all border-b-2 hover:bg-zinc-100 ${
                    isActive
                      ? "border-indigo-650 text-indigo-750 font-bold bg-white"
                      : "border-transparent hover:text-zinc-800"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TABLE ACTIONS BAR */}
          <div className="p-4 border-b border-zinc-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            
            <div className="flex flex-wrap items-center gap-2.5">
              {/* SHOW ENTRIES SELECT */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-550 font-bold">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded border border-zinc-300 px-2 bg-white outline-none font-bold cursor-pointer"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <span>entries</span>
              </div>

              {/* TABLE EXPORTERS */}
              <div className="flex items-center border border-zinc-200 rounded overflow-hidden">
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-zinc-50 text-zinc-650 hover:bg-zinc-100 text-xs font-bold border-r border-zinc-200 transition">Export CSV</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-zinc-50 text-zinc-650 hover:bg-zinc-100 text-xs font-bold border-r border-zinc-200 transition">Export Excel</button>
                <button onClick={handlePrint} className="px-3 py-1.5 bg-zinc-50 text-zinc-650 hover:bg-zinc-100 text-xs font-bold border-r border-zinc-200 transition">Print</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-zinc-50 text-zinc-650 hover:bg-zinc-100 text-xs font-bold transition">Export PDF</button>
              </div>
            </div>

            {/* SEARCH LEDGER */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8.5 w-56 pl-9 pr-3 rounded border border-zinc-300 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
              />
            </div>

          </div>

          {/* TABLE DISPLAY */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-zinc-50 text-zinc-650 font-extrabold border-b border-zinc-200 uppercase tracking-wider text-xs">
                <tr>
                  {activeHeaders.map((header, i) => (
                    <th
                      key={i}
                      onClick={() => handleHeaderClick(i)}
                      className="px-4 py-3 cursor-pointer select-none hover:bg-zinc-100 hover:text-zinc-800 transition"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-sm text-zinc-800 bg-white">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-zinc-400 text-xs font-semibold">
                      No matching report entries.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, rIdx) => {
                    const values = Object.keys(row).map((key) => row[key]);
                    return (
                      <tr key={rIdx} className="hover:bg-zinc-50/40 transition">
                        {values.map((val, cIdx) => (
                          <td key={cIdx} className={`px-4 py-3 font-semibold ${cIdx === 1 ? "text-zinc-800 font-bold" : "text-zinc-700"}`}>
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}

                {/* TOTALS FOOTER ROW */}
                {sortedRows.length > 0 && (
                  <tr className="bg-zinc-100/70 border-t border-zinc-200 text-sm font-bold text-zinc-800">
                    <td className="px-4 py-3">Total:</td>
                    <td className="px-4 py-3 text-zinc-900">{currencyFmt(tabTotal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION PANEL */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between text-xs font-bold text-zinc-550 print:hidden">
              <span>
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, sortedRows.length)} of {sortedRows.length} entries
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="h-8 w-8 rounded border border-zinc-300 bg-white flex items-center justify-center hover:bg-zinc-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="h-8 w-8 rounded border border-zinc-300 bg-white flex items-center justify-center hover:bg-zinc-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM INFORMATIONAL NOTE */}
        <div className="text-xs font-bold text-zinc-450 leading-relaxed print:hidden">
          Note: Profit by products/categories/brands only considers inline discount. Invoice discount is not considered.
        </div>

        {/* FOOTER BRANDING */}
        <div className="text-center text-xs text-zinc-400 pt-4 border-t border-zinc-200 print:hidden">
          Apple Tech POS - v6.7 | Copyright © 2026 All rights reserved.
        </div>

      </div>
    );
  }

  // --- GENERIC SUMMARY CHART LEDGER DISPLAY FOR OTHER REPORTS ---
  const maxChartVal = Math.max(...reportData.chartData.map((d) => d.value), 1);

  return (
    <div className="p-6 space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">{reportData.title}</h1>
          <p className="text-xs text-zinc-450 mt-1">{reportData.description}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={reportData.rows.length === 0}
            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition ${
              reportData.rows.length === 0
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {reportData.summaryCards.map((card, i) => (
          <div key={i} className="bg-white rounded-lg border border-zinc-200 p-5 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-450">{card.label}</span>
            <h2 className="text-xl font-bold text-zinc-800">{card.value}</h2>
            {card.desc && <p className="text-xs text-zinc-400 font-semibold">{card.desc}</p>}
          </div>
        ))}
      </div>

      {reportData.chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-indigo-650" /> Graphical Distribution
          </h3>

          <div className="space-y-3 pt-2">
            {reportData.chartData.map((d, index) => {
              const percentage = Math.max((d.value / maxChartVal) * 100, 2);
              return (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-zinc-700">
                    <span>{d.name}</span>
                    <span className="text-zinc-500">
                      {d.value.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-4 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative">
                    <div
                      className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-indigo-700 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
        
        <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <List className="h-4 w-4 text-indigo-650 shrink-0" />
            <span className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">Report Ledger</span>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-zinc-400" />
            </div>
            <input
              type="text"
              placeholder="Search in ledger..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 w-60 pl-9 pr-3 rounded border border-zinc-300 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-zinc-50 text-zinc-655 font-extrabold border-b border-zinc-200 uppercase tracking-wider text-xs">
              <tr>
                {activeHeaders.map((header, i) => (
                  <th
                    key={i}
                    onClick={() => handleHeaderClick(i)}
                    className="px-4 py-3 cursor-pointer select-none hover:bg-zinc-100 hover:text-zinc-800 transition"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm text-zinc-800 bg-white">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={activeHeaders.length} className="px-4 py-8 text-center text-zinc-400 text-xs font-semibold">
                    No matching report entries.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rIdx) => {
                  const values = Object.keys(row).map((key) => row[key]);
                  return (
                    <tr key={rIdx} className="hover:bg-zinc-50/40 transition">
                      {values.map((val, cIdx) => (
                        <td key={cIdx} className="px-4 py-3 font-semibold text-zinc-700">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between text-xs font-bold text-zinc-550">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, sortedRows.length)} of {sortedRows.length} entries
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="h-8 w-8 rounded border border-zinc-300 bg-white flex items-center justify-center hover:bg-zinc-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="h-8 w-8 rounded border border-zinc-300 bg-white flex items-center justify-center hover:bg-zinc-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
