"use client";

export type RegisterSummary = {
  session: {
    openedAt: string;
    closedAt: string | null;
    openingFloat: number;
    openedByName: string;
    openedByEmail: string;
    closedByName: string | null;
    status: string;
    closingCount: number | null;
    cashDifference: number | null;
  };
  paymentBreakdown: Record<string, number>;
  refundByMethod: Record<string, number>;
  totalSales: number;
  totalRefund: number;
  totalPayment: number;
  creditSales: number;
  totalExpense: number;
  paidPurchaseDue: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  voidedCount: number;
  productsSold: { sku: string; name: string; brand: string | null; qty: number; total: number }[];
  productsSoldByBrand: { brand: string; qty: number; total: number }[];
  grandTotalQty: number;
  grandTotalAmount: number;
};

const fmt = (n: number) => `Rs ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const METHOD_LABEL: Record<string, string> = { cash: "Cash Payment", card: "Card Payment", wallet: "Digital Wallet" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export function RegisterSummaryReport({ title, summary }: { title: string; summary: RegisterSummary }) {
  const { session } = summary;
  const rangeLabel = `${fmtDate(session.openedAt)} - ${session.closedAt ? fmtDate(session.closedAt) : "now"}`;

  return (
    <div className="space-y-5 print:text-black">
      <div>
        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="text-xs text-zinc-500">({rangeLabel})</p>
      </div>

      {/* Payment method breakdown */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left">
            <tr>
              <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400">Payment Method</th>
              <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 text-right">Sell</th>
              <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 text-right">Refund</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <tr>
              <td className="px-3 py-2 font-semibold">Cash in hand (opening)</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums" colSpan={2}>{fmt(session.openingFloat)}</td>
            </tr>
            {Object.entries(summary.paymentBreakdown).map(([method, sell]) => (
              <tr key={method}>
                <td className="px-3 py-2 font-semibold">{METHOD_LABEL[method] ?? method}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(sell)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-red-600">
                  {summary.refundByMethod[method] ? `-${fmt(summary.refundByMethod[method])}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary totals */}
      <div className="space-y-1.5 text-xs">
        <Row label="Total Sales" value={fmt(summary.totalSales)} />
        <Row label="Total Refund" value={`-${fmt(summary.totalRefund)}`} tone="negative" />
        <Row label="Total Payment (Sales − Refund)" value={fmt(summary.totalPayment)} bold />
        <Row label="Credit Sales" value={fmt(summary.creditSales)} />
        <Row label="Total Expense" value={`-${fmt(summary.totalExpense)}`} tone="negative" />
        <Row label="Paid Purchase Due (cash)" value={`-${fmt(summary.paidPurchaseDue)}`} tone="negative" />
        <Row label="Cash In (manual)" value={fmt(summary.cashIn)} />
        <Row label="Cash Out (manual)" value={`-${fmt(summary.cashOut)}`} tone="negative" />
        {summary.voidedCount > 0 && (
          <p className="text-[11px] text-zinc-400 pt-1">{summary.voidedCount} voided sale(s) excluded from these totals.</p>
        )}
      </div>

      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-3.5 border border-indigo-100 dark:border-indigo-900">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">Expected Cash in Drawer</span>
          <span className="text-lg font-black font-mono tabular-nums text-indigo-700 dark:text-indigo-400">{fmt(summary.expectedCash)}</span>
        </div>
        <p className="text-[11px] text-indigo-500 dark:text-indigo-500 mt-1">
          = Opening float + Cash sales + Cash in − Cash out − Cash refunds − Expenses − Cash purchase payments
        </p>
      </div>

      {session.status === "closed" && session.closingCount !== null && (
        <div className={`rounded-lg p-3.5 border ${
          session.cashDifference === 0
            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900"
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
        }`}>
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">Actual Cash Counted</span>
            <span className="text-lg font-black font-mono tabular-nums">{fmt(session.closingCount)}</span>
          </div>
          <div className="flex justify-between items-baseline mt-1">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">Difference</span>
            <span className={`text-sm font-bold font-mono tabular-nums ${
              (session.cashDifference ?? 0) === 0 ? "text-emerald-600" : (session.cashDifference ?? 0) > 0 ? "text-emerald-600" : "text-red-600"
            }`}>
              {(session.cashDifference ?? 0) === 0 ? "Matched" : `${(session.cashDifference ?? 0) > 0 ? "Over" : "Short"} by ${fmt(Math.abs(session.cashDifference ?? 0))}`}
            </span>
          </div>
        </div>
      )}

      {/* Products sold */}
      {summary.productsSold.length > 0 && (
        <div>
          <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-2">Details of products sold</h4>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-left sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400">#</th>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400">SKU</th>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400">Product</th>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 text-right">Qty</th>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {summary.productsSold.map((p, i) => (
                  <tr key={p.sku}>
                    <td className="px-3 py-1.5 text-zinc-400">{i + 1}.</td>
                    <td className="px-3 py-1.5 font-mono text-zinc-500">{p.sku}</td>
                    <td className="px-3 py-1.5 font-semibold">{p.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{p.qty.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmt(p.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-50 dark:bg-zinc-900 font-bold">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>#</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{summary.grandTotalQty.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">Grand Total: {fmt(summary.grandTotalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {summary.productsSoldByBrand.length > 0 && (
        <div>
          <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-2">Details of products sold (By Brand)</h4>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-left">
                <tr>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400">#</th>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400">Brand</th>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 text-right">Qty</th>
                  <th className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-400 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {summary.productsSoldByBrand.map((b, i) => (
                  <tr key={b.brand}>
                    <td className="px-3 py-1.5 text-zinc-400">{i + 1}.</td>
                    <td className="px-3 py-1.5 font-semibold">{b.brand}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{b.qty.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmt(b.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-50 dark:bg-zinc-900 font-bold">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>#</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{summary.grandTotalQty.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">Grand Total: {fmt(summary.grandTotalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-150 dark:border-zinc-800 pt-3 text-[11px] text-zinc-500 space-y-0.5">
        <p><span className="font-bold">Opened by:</span> {session.openedByName}</p>
        <p><span className="font-bold">Email:</span> {session.openedByEmail}</p>
        {session.closedByName && <p><span className="font-bold">Closed by:</span> {session.closedByName}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "negative" }) {
  return (
    <div className={`flex justify-between items-baseline ${bold ? "font-bold border-t border-zinc-150 dark:border-zinc-800 pt-1.5" : ""}`}>
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className={`font-mono tabular-nums ${tone === "negative" ? "text-red-600" : ""}`}>{value}</span>
    </div>
  );
}
