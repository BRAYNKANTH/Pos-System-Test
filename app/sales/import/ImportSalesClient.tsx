"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { parseCsvToObjects } from "@/lib/csv";
import { errorMessage } from "@/lib/errors";

type ParsedRow = {
  date: string;
  reference: string;
  sku: string;
  qty: string;
  unitPrice: string;
  discount: string;
  paymentMethod: string;
  customerEmail: string;
};

type RowIssue = { rowIndex: number; message: string };

const REQUIRED_COLUMNS = ["date", "sku", "qty"];
const ALL_COLUMNS = ["date", "reference", "sku", "qty", "unitprice", "discount", "paymentmethod", "customeremail"];

const SAMPLE_CSV = `date,reference,sku,qty,unitPrice,discount,paymentMethod,customerEmail
2026-06-01,INV-1001,SKU-001,2,350,0,cash,
2026-06-01,INV-1001,SKU-002,1,450,50,cash,
2026-06-02,,SKU-003,1,300,0,card,jane@example.com
`;

export function ImportSalesClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [deductStock, setDeductStock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ transactionsCreated: number; rowsImported: number } | null>(null);

  const { rows, headerIssues, clientIssues } = useMemo(() => {
    if (!csvText.trim()) return { rows: [] as ParsedRow[], headerIssues: [] as string[], clientIssues: [] as RowIssue[] };

    const objects = parseCsvToObjects(csvText);
    if (objects.length === 0) return { rows: [], headerIssues: ["File is empty."], clientIssues: [] };

    const headers = Object.keys(objects[0]);
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    const unknown = headers.filter((h) => !ALL_COLUMNS.includes(h));
    const headerIssues: string[] = [];
    if (missing.length > 0) headerIssues.push(`Missing required column(s): ${missing.join(", ")}`);
    if (unknown.length > 0) headerIssues.push(`Unrecognized column(s) (ignored): ${unknown.join(", ")}`);

    const parsed: ParsedRow[] = objects.map((o) => ({
      date: o.date ?? "",
      reference: o.reference ?? "",
      sku: o.sku ?? "",
      qty: o.qty ?? "",
      unitPrice: o.unitprice ?? "",
      discount: o.discount ?? "",
      paymentMethod: o.paymentmethod ?? "",
      customerEmail: o.customeremail ?? "",
    }));

    const issues: RowIssue[] = [];
    parsed.forEach((r, idx) => {
      const rowIndex = idx + 1;
      if (!r.date || isNaN(new Date(r.date).getTime())) {
        issues.push({ rowIndex, message: "Invalid or missing date" });
      }
      if (!r.sku) issues.push({ rowIndex, message: "Missing sku" });
      const qty = Number(r.qty);
      if (!Number.isFinite(qty) || qty <= 0) issues.push({ rowIndex, message: "qty must be a positive number" });
      if (r.unitPrice && (!Number.isFinite(Number(r.unitPrice)) || Number(r.unitPrice) < 0)) {
        issues.push({ rowIndex, message: "unitPrice must be a non-negative number" });
      }
    });

    return { rows: parsed, headerIssues, clientIssues: issues };
  }, [csvText]);

  const issuesByRow = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const issue of clientIssues) {
      const list = map.get(issue.rowIndex) ?? [];
      list.push(issue.message);
      map.set(issue.rowIndex, list);
    }
    return map;
  }, [clientIssues]);

  const validRowCount = rows.length - issuesByRow.size;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function handleDownloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample-sales-import.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const payload = rows.map((r) => ({
        date: r.date,
        reference: r.reference,
        sku: r.sku,
        qty: Number(r.qty),
        unitPrice: r.unitPrice ? Number(r.unitPrice) : undefined,
        discount: r.discount ? Number(r.discount) : undefined,
        paymentMethod: r.paymentMethod || undefined,
        customerEmail: r.customerEmail || undefined,
      }));
      const res = await fetch("/api/sales/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, deductStock }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        const details = body.error?.details?.errors as RowIssue[] | undefined;
        const detailText = details?.length
          ? " — " + details.slice(0, 5).map((d) => `row ${d.rowIndex}: ${d.message}`).join("; ")
          : "";
        setError((body.error?.message ?? "Import failed.") + detailText);
        return;
      }
      setResult(body.data);
      setCsvText("");
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(errorMessage(err, "Network error — nothing was imported."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 tracking-tight flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-indigo-600" /> Import Sales
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Bulk-import historical sales records from a CSV file — e.g. migrating from another POS. This creates
          past-dated transactions for reporting continuity; it does not open a live register session.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-xs font-bold transition">
            <FileText className="h-4 w-4 text-indigo-600" />
            {fileName ?? "Choose CSV file..."}
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
          </label>
          <button
            onClick={handleDownloadSample}
            type="button"
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
          >
            <Download className="h-3.5 w-3.5" /> Download sample CSV
          </button>
        </div>

        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
          <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">Columns:</p>
          <p>
            <code className="font-mono">date</code>* · <code className="font-mono">sku</code>* ·{" "}
            <code className="font-mono">qty</code>* · <code className="font-mono">reference</code> (groups rows into
            one multi-item sale) · <code className="font-mono">unitPrice</code> (defaults to catalog price) ·{" "}
            <code className="font-mono">discount</code> · <code className="font-mono">paymentMethod</code> (cash/card/wallet/gift_card,
            default cash) · <code className="font-mono">customerEmail</code> (must match an existing customer; blank = walk-in)
          </p>
          <p className="mt-1">* required</p>
        </div>

        {headerIssues.length > 0 && (
          <div className="flex items-start gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>{headerIssues.map((h, i) => <p key={i}>{h}</p>)}</div>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-zinc-600 dark:text-zinc-400">
                {rows.length} row{rows.length === 1 ? "" : "s"} parsed —{" "}
                <span className={issuesByRow.size > 0 ? "text-red-600" : "text-emerald-600"}>
                  {validRowCount} valid{issuesByRow.size > 0 ? `, ${issuesByRow.size} with errors` : ""}
                </span>
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-80 overflow-y-auto">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-850 sticky top-0 text-zinc-500 font-bold uppercase">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Unit Price</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {rows.map((r, idx) => {
                    const rowIssues = issuesByRow.get(idx + 1);
                    return (
                      <tr key={idx} className={rowIssues ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                        <td className="px-3 py-1.5 text-zinc-400">{idx + 1}</td>
                        <td className="px-3 py-1.5 font-mono">{r.date}</td>
                        <td className="px-3 py-1.5 font-mono">{r.reference}</td>
                        <td className="px-3 py-1.5 font-mono">{r.sku}</td>
                        <td className="px-3 py-1.5">{r.qty}</td>
                        <td className="px-3 py-1.5">{r.unitPrice}</td>
                        <td className="px-3 py-1.5">{r.paymentMethod || "cash"}</td>
                        <td className="px-3 py-1.5 text-red-600 font-semibold">{rowIssues?.join("; ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={deductStock} onChange={(e) => setDeductStock(e.target.checked)} className="h-4 w-4" />
              Also deduct these quantities from current stock levels
              <span className="text-zinc-400 font-normal">
                (leave unchecked if your current stock counts already reflect these historical sales)
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="flex items-start gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Imported {result.rowsImported} row(s) as {result.transactionsCreated} transaction(s).{" "}
                  <button onClick={() => router.push("/sales")} className="underline">View sales</button>
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleImport}
                disabled={submitting || issuesByRow.size > 0 || headerIssues.some((h) => h.startsWith("Missing"))}
                className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Importing..." : `Import ${validRowCount} row(s)`}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
