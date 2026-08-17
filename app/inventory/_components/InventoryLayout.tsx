"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Grid,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { AppSidebar } from "@/app/_components/AppSidebar";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [currentDate, setCurrentDate] = useState("06-08-2026");

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString("en-GB").replace(/\//g, "-"));
    // /api/business-info — see AppSidebar.tsx for why not the
    // SETTINGS_MANAGE-gated /api/admin/business-settings.
    fetch("/api/business-info")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.bizName) setBusinessName(res.data.bizName);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex print:bg-white print:text-black">

      {/* ── DESKTOP SIDEBAR — fixed, persistent ────────────────────────── */}
      <aside className="w-64 bg-white border-r border-zinc-200 hidden lg:flex flex-col shrink-0 sticky top-0 h-screen print:hidden">
        <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
      </aside>

      {/* ── MOBILE DRAWER OVERLAY ───────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-xs flex-1 flex flex-col bg-white border-r animate-slide-in shadow-2xl">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Navbar Header */}
        <header className="h-16 bg-indigo-900 text-white px-5 flex items-center justify-between border-b shadow-sm shrink-0 sticky top-0 z-30 print:hidden">
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

          <div className="flex items-center gap-3">
            <button className="h-8 w-8 hover:bg-white/10 rounded flex items-center justify-center text-zinc-300 transition">
              <Plus className="h-4.5 w-4.5" />
            </button>
            <Link
              href="/pos"
              className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Grid className="h-4 w-4" />
              POS
            </Link>
            <button className="h-8 w-8 hover:bg-white/10 rounded flex items-center justify-center text-zinc-300 transition relative">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500"></span>
            </button>
          </div>
        </header>

        {/* Page Content — swaps between List/Add/Print Labels as "tabs" */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  );
}
