import Link from "next/link";
import { BarChart3, Clock, TrendingUp, ShieldAlert, Award, FileText } from "lucide-react";

const REPORTS = [
  { href: "/reports/profit-loss", label: "Profit / Loss Report", desc: "Gross and net profit calculations based on sales, COGS, and expenses." },
  { href: "/reports/purchase-sale", label: "Purchase & Sale", desc: "Compare inventory purchases against transaction sales values." },
  { href: "/reports/tax", label: "Tax Report", desc: "Overview of taxes collected on transaction checkouts." },
  { href: "/reports/supplier-customer", label: "Supplier & Customer Report", desc: "Transaction counts and values grouped by business contacts." },
  { href: "/reports/customer-groups", label: "Customer Groups Report", desc: "Customer spending distributions per profile group." },
  { href: "/reports/stock", label: "Stock Report", desc: "Real-time list of inventory quantities on hand and asset values." },
  { href: "/reports/stock-expiry", label: "Stock Expiry Report", desc: "Monitor products approaching expiration dates." },
  { href: "/reports/stock-adjustment", label: "Stock Adjustment Report", desc: "Review discrepancies and stock adjustments applied." },
  { href: "/reports/stock-transfer", label: "Stock Transfer Report", desc: "Track stock movements between business locations." },
  { href: "/reports/trending-products", label: "Trending Products", desc: "Rank catalog items sold by volume." },
  { href: "/reports/items", label: "Items Report", desc: "Line-item log of individual products sold." },
  { href: "/reports/product-purchase", label: "Product Purchase Report", desc: "Purchase asset valuations for all products." },
  { href: "/reports/product-sell", label: "Product Sell Report", desc: "Sales performance tracking per catalog product." },
  { href: "/reports/purchase-payment", label: "Purchase Payment Report", desc: "Supplier payments ledger tracking." },
  { href: "/reports/sell-payment", label: "Sell Payment Report", desc: "Total customer payment collections by tender type." },
  { href: "/reports/expense", label: "Expense Report", desc: "Operating expenditures and utility logs." },
  { href: "/reports/register", label: "Register Report", desc: "Transaction activity breakdown per register terminal." },
  { href: "/reports/sales-representative", label: "Sales Representative Report", desc: "Track sales performance per cashier rep." },
  
  // Existing system reports
  { href: "/reports/daily", label: "Daily Reconciliation (Z-Report)", desc: "End of day terminal reconciliation summaries." },
  { href: "/reports/sales", label: "Sales Trends", desc: "Sales trends visual tracking." },
  { href: "/reports/audit", label: "Audit Report", desc: "Audit logging trail for stock and bill modifications." },
];

export default function ReportsPage() {
  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-indigo-650" /> System Reports
        </h1>
        <p className="text-xs text-zinc-450 mt-1">Select an active reports module to run queries, view summaries, and export data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group bg-white rounded-lg border border-zinc-200 p-5 shadow-sm hover:border-indigo-500 hover:shadow transition flex flex-col justify-between"
          >
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-zinc-800 group-hover:text-indigo-650 transition">
                {r.label}
              </h3>
              <p className="text-xs text-zinc-450 leading-relaxed">
                {r.desc}
              </p>
            </div>
            <div className="text-xs font-extrabold text-indigo-650 uppercase tracking-wider mt-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Open Report &rarr;
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
