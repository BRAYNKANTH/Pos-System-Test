"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home as HomeIcon,
  Users,
  Contact,
  Package,
  ShoppingCart,
  History,
  Settings,
  ChevronDown,
  BarChart3,
} from "lucide-react";

// ─── Business name cache ─────────────────────────────────────────────────────
// Previously, both AppSidebar AND DashboardClient independently called
// /api/admin/business-settings on every mount — and the sidebar was being
// re-mounted each time the mobile drawer opened, causing a fresh request every
// tap. Now we cache in sessionStorage (cleared on tab close) so the network
// call happens at most once per session.
const BIZ_CACHE_KEY = "pos_biz_name";

function getCachedBizName(): string | null {
  try {
    return sessionStorage.getItem(BIZ_CACHE_KEY);
  } catch {
    return null;
  }
}

function setCachedBizName(name: string) {
  try {
    sessionStorage.setItem(BIZ_CACHE_KEY, name);
  } catch {
    // sessionStorage unavailable (e.g. private browsing with quota set to 0)
  }
}

export function AppSidebar({
  onNavigate,
  user,
  initialBizName,
}: {
  onNavigate?: () => void;
  user?: { name: string; role: string };
  /** Pass from parent to skip fetch entirely when already known. */
  initialBizName?: string;
}) {
  const pathname = usePathname();
  const [businessName, setBusinessName] = useState(initialBizName ?? "");

  useEffect(() => {
    // If parent supplied it, sync the state and cache it
    if (initialBizName) {
      setBusinessName(initialBizName);
      setCachedBizName(initialBizName);
      return;
    }
    const cached = getCachedBizName();
    if (cached) {
      setBusinessName(cached);
      return;
    }
    // /api/business-info, not /api/admin/business-settings — the admin
    // endpoint requires SETTINGS_MANAGE, which cashiers don't have. That
    // 403 was being silently swallowed here, so cashiers never saw a real
    // business name at all — just whatever hardcoded fallback shipped in
    // the code, permanently, regardless of what Settings actually said.
    fetch("/api/business-info")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.bizName) {
          setBusinessName(res.data.bizName);
          setCachedBizName(res.data.bizName);
        }
      })
      .catch(() => {});
  }, [initialBizName]);

  // Memoized link renderer — avoids re-creating the function on every render.
  const navLink = useCallback(
    (href: string, label: string, disabled?: boolean) => {
      // Exact match for root, startsWith for everything else — ensures that
      // /inventory/add-product correctly highlights the "List Products" parent
      // section and the specific sub-link that matches.
      const active = href === "/" ? pathname === href : pathname.startsWith(href);

      if (disabled) {
        return (
          <span
            key={href}
            className="py-1 flex items-center gap-1.5 opacity-50 cursor-not-allowed select-none text-zinc-500"
            title="Not yet implemented"
          >
            {label}
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600">
              soon
            </span>
          </span>
        );
      }

      return (
        <Link
          href={href}
          onClick={onNavigate}
          className={`py-1 transition ${active ? "font-bold text-indigo-700 dark:text-indigo-400" : "hover:text-indigo-600 dark:hover:text-indigo-400"}`}
        >
          {label}
        </Link>
      );
    },
    [pathname, onNavigate]
  );

  return (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-zinc-950">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800 gap-2 bg-indigo-900 text-white select-none">
          <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="font-bold text-lg tracking-tight truncate">{businessName}</span>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1" aria-label="Main navigation">
          <Link
            href="/"
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
              pathname === "/"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                : "text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <HomeIcon className="h-5 w-5 shrink-0" />
            <span>Home</span>
          </Link>

          <details className="group" open={pathname.startsWith("/admin")}>
            <summary className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition list-none cursor-pointer">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 shrink-0" />
                <span>User Management</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-400 shrink-0" />
            </summary>
            <div className="pl-4 pr-3 py-1 ml-[21px] flex flex-col gap-1.5 text-sm border-l border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              {navLink("/admin/users", "Users")}
              {navLink("/admin/settings/roles", "Roles")}
            </div>
          </details>

          <Link
            href="/customers"
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition ${
              pathname.startsWith("/customers")
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                : "text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Contact className="h-5 w-5 shrink-0" />
            <span>Contacts</span>
          </Link>

          <details className="group" open={pathname.startsWith("/inventory")}>
            <summary className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition list-none cursor-pointer">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 shrink-0" />
                <span>Products</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-400 shrink-0" />
            </summary>
            <div className="pl-4 pr-3 py-1 ml-[21px] flex flex-col gap-1.5 text-sm border-l border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              {navLink("/inventory", "List Products")}
              {navLink("/inventory/add-product", "Add Product")}
              {navLink("/inventory/print-labels", "Print Labels")}
              {navLink("/inventory/categories", "Categories", true)}
              {navLink("/inventory/brands", "Brands", true)}
            </div>
          </details>

          <details
            className="group"
            open={
              pathname.startsWith("/purchases") ||
              pathname.startsWith("/suppliers") ||
              pathname.startsWith("/inventory/stock-transfer")
            }
          >
            <summary className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition list-none cursor-pointer">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 shrink-0" />
                <span>Purchases</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-400 shrink-0" />
            </summary>
            <div className="pl-4 pr-3 py-1 ml-[21px] flex flex-col gap-1.5 text-sm border-l border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              {navLink("/purchases", "List Purchases")}
              {navLink("/purchases/add", "Add Purchase")}
              {navLink("/suppliers", "Suppliers")}
              {navLink("/inventory/stock-transfer", "Stock Transfer")}
            </div>
          </details>

          <details
            className="group"
            open={pathname.startsWith("/sales") || pathname === "/pos"}
          >
            <summary className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition list-none cursor-pointer">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 shrink-0" />
                <span>Sell</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-400 shrink-0" />
            </summary>
            <div className="pl-4 pr-3 py-1 ml-[21px] flex flex-col gap-1.5 text-sm border-l border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              {navLink("/sales", "All sales")}
              {navLink("/pos", "POS")}
              {navLink("/sales/drafts", "List Drafts")}
              {navLink("/sales/quotations/add", "Add Quotation")}
              {navLink("/sales/quotations", "List Quotations")}
              {navLink("/sales/returns", "List Sell Return")}
              {navLink("/sales/shipments", "Shipments")}
              {navLink("/sales/discounts", "Discounts")}
              {navLink("/admin/gift-cards", "Gift Cards")}
            </div>
          </details>

          <details className="group" open={pathname.startsWith("/reports")}>
            <summary className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition list-none cursor-pointer">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 shrink-0" />
                <span>Reports</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-400 shrink-0" />
            </summary>
            {/* Reports sub-links use text-sm (was text-xs — inconsistent with all other groups) */}
            <div className="pl-4 pr-3 py-1 ml-[21px] flex flex-col gap-1.5 text-sm border-l border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              {navLink("/reports/profit-loss", "Profit / Loss Report")}
              {navLink("/reports/purchase-sale", "Purchase & Sale")}
              {navLink("/reports/tax", "Tax Report")}
              {navLink("/reports/supplier-customer", "Supplier & Customer Report")}
              {navLink("/reports/customer-groups", "Customer Groups Report")}
              {navLink("/reports/stock", "Stock Report")}
              {navLink("/reports/stock-expiry", "Stock Expiry Report")}
              {navLink("/reports/stock-adjustment", "Stock Adjustment Report")}
              {navLink("/reports/stock-transfer", "Stock Transfer Report")}
              {navLink("/reports/trending-products", "Trending Products")}
              {navLink("/reports/items", "Items Report")}
              {navLink("/reports/product-purchase", "Product Purchase Report")}
              {navLink("/reports/product-sell", "Product Sell Report")}
              {navLink("/reports/purchase-payment", "Purchase Payment Report")}
              {navLink("/reports/sell-payment", "Sell Payment Report")}
              {navLink("/reports/expense", "Expense Report")}
              {navLink("/reports/register", "Register Report")}
              {navLink("/reports/sales-representative", "Sales Representative Report")}
            </div>
          </details>

          <details className="group" open={pathname.startsWith("/admin/settings")}>
            <summary className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 transition list-none cursor-pointer">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 shrink-0" />
                <span>Settings</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-400 shrink-0" />
            </summary>
            <div className="pl-4 pr-3 py-1 ml-[21px] flex flex-col gap-1.5 text-sm border-l border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              {navLink("/admin/settings/business", "Business Settings")}
              {navLink("/admin/settings/locations", "Business Locations")}
              {navLink("/admin/settings/invoice", "Invoice Settings")}
              {navLink("/admin/settings/barcode", "Barcode Settings")}
              {navLink("/admin/settings/printers", "Receipt Printers")}
              {navLink("/admin/settings/tax", "Tax Rates")}
              {navLink("/admin/settings/integrations", "Zoho Integration")}
              {navLink("/admin/settings/roles", "Roles")}
            </div>
          </details>
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-500">
        <p className="font-bold text-zinc-700 dark:text-zinc-300">{user?.name ?? "ADMIN"}</p>
        {user?.role && (
          <p className="capitalize text-xs font-semibold mt-0.5 text-zinc-500 dark:text-zinc-400">
            {user.role.toLowerCase()}
          </p>
        )}
      </div>
    </div>
  );
}
