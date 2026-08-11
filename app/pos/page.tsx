"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/lib/pos/cart-store";
import { CartPanel } from "./_components/CartPanel";
import { ProductSearch } from "./_components/ProductSearch";
import { PaymentModal } from "./_components/PaymentModal";
import { RegisterStatusBar } from "./_components/RegisterStatusBar";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { calculateCart, applyDiscount } from "@/lib/pos/pricing";
import {
  RotateCcw,
  Calculator,
  FolderOpen,
  RefreshCw,
  CreditCard,
  Pause,
  Plus,
  Trash2,
  Calendar,
  XCircle,
  FileText,
  DollarSign,
  History,
  TrendingUp,
  MapPin,
  Clock,
  Briefcase,
  Home
} from "lucide-react";

type HeldCart = {
  id: string;
  type: string;
  lines: any;
  discount: any;
  shipping: number;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  createdAt: string;
  note?: string;
};

type RecentTx = {
  id: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
  customer?: { name: string } | null;
  items: any[];
};

export default function PosPage() {
  const {
    lines,
    discount,
    shipping,
    customerId,
    customerName,
    loadHeldCart,
    clear,
  } = useCartStore();

  const [currentTime, setCurrentTime] = useState("");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([]);
  // Products — fetched once and passed to both CartPanel and ProductSearch.
  // Previously each component fetched independently, causing 2 identical
  // /api/pos/products requests on every page load.
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/pos/products")
      .then((r) => r.json())
      .then((body) => { if (body.success) setProducts(body.data); });
  }, []);

  // Modals state
  const [isRecentModalOpen, setIsRecentModalOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  // Calculator inputs
  const [calcInput, setCalcInput] = useState("");
  const [calcResult, setCalcResult] = useState("");

  // Expense form inputs
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("rent");
  const [expenseNote, setExpenseNote] = useState("");

  // Notification alerts
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Digital clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
      const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setCurrentTime(`${dateStr} ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  // Compute pricing
  const calculation = useMemo(() => {
    if (lines.length === 0) {
      return { lines: [], subtotal: 0, totalDiscount: 0, tax: 0, shipping: 0, total: 0 };
    }
    let cartLines = lines.map((l) => ({
      sku: l.sku,
      qty: l.qty,
      unitPrice: l.unitPrice,
    }));
    if (discount) {
      cartLines = applyDiscount(cartLines, {
        scope: "cart",
        type: discount.type,
        value: discount.value,
      });
    }
    // Hardcoded default tax 8% standard
    return calculateCart(cartLines, 0.08, shipping);
  }, [lines, discount, shipping]);

  const totalPayable = calculation.total;
  const totalItems = lines.reduce((sum, l) => sum + l.qty, 0);

  // Fetch suspended/held carts
  async function fetchHeldCarts() {
    try {
      const res = await fetch("/api/pos/held-carts");
      const body = await res.json();
      if (body.success) setHeldCarts(body.data);
    } catch (err) {
      console.error(err);
    }
  }

  // Fetch recent completed transactions
  async function fetchRecentTransactions() {
    try {
      const res = await fetch("/api/pos/transactions");
      const body = await res.json();
      if (body.success) setRecentTxs(body.data);
    } catch (err) {
      console.error(err);
    }
  }

  // Save held cart
  async function handleHoldCart(type: "draft" | "suspended") {
    if (lines.length === 0) {
      triggerAlert("error", "Cart cannot be empty to hold");
      return;
    }

    try {
      const res = await fetch("/api/pos/held-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          customerId,
          lines: lines.map((l) => ({ sku: l.sku, name: l.name, unitPrice: l.unitPrice, qty: l.qty })),
          discount,
          shipping,
          note: type === "suspended" ? "Suspended POS sale" : "Draft POS sale",
        }),
      });
      const body = await res.json();
      if (body.success) {
        clear();
        triggerAlert("success", `Sale saved as ${type} successfully.`);
      } else {
        triggerAlert("error", body.error?.message ?? "Failed to hold sale");
      }
    } catch (err) {
      triggerAlert("error", "Failed to contact server. Checking offline capability.");
    }
  }

  // Resume a held cart
  async function handleResumeCart(cart: HeldCart) {
    // Format JSON lines back to CartLine
    const cartLines = Array.isArray(cart.lines) ? cart.lines : [];
    
    loadHeldCart({
      id: cart.id,
      lines: cartLines,
      discount: cart.discount,
      shipping: cart.shipping,
      customerId: cart.customerId,
      customerName: cart.customer?.name ?? null,
    });

    // Delete resumed cart draft immediately from backend
    await fetch(`/api/pos/held-carts/${cart.id}`, { method: "DELETE" }).catch(() => {});

    setIsHeldModalOpen(false);
    triggerAlert("success", "Draft resumed successfully.");
  }

  // Delete held cart
  async function handleDeleteHeldCart(id: string) {
    try {
      await fetch(`/api/pos/held-carts/${id}`, { method: "DELETE" });
      setHeldCarts((prev) => prev.filter((c) => c.id !== id));
      triggerAlert("success", "Draft deleted.");
    } catch (err) {
      console.error(err);
    }
  }

  // Trigger transient banner alerts
  function triggerAlert(type: "success" | "error", text: string) {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  }

  // Simple Calculator — safe arithmetic parser replacing the former
  // Function() constructor eval which is blocked by strict CSP policies.
  function handleCalcPress(val: string) {
    if (val === "C") {
      setCalcInput("");
      setCalcResult("");
      return;
    }
    if (val === "=") {
      try {
        // Safe recursive descent parser for +, -, *, /
        const result = safeEval(calcInput);
        setCalcResult(isFinite(result) ? String(result) : "Error");
      } catch {
        setCalcResult("Error");
      }
    } else {
      setCalcInput((prev) => prev + val);
    }
  }

  // Minimal safe arithmetic evaluator — handles +, -, *, / and parentheses.
  // No dynamic code execution; parses the expression as a recursive grammar.
  function safeEval(expr: string): number {
    expr = expr.replace(/\s+/g, "");
    let pos = 0;
    function parseExpr(): number {
      let left = parseTerm();
      while (pos < expr.length && (expr[pos] === "+" || expr[pos] === "-")) {
        const op = expr[pos++];
        const right = parseTerm();
        left = op === "+" ? left + right : left - right;
      }
      return left;
    }
    function parseTerm(): number {
      let left = parseFactor();
      while (pos < expr.length && (expr[pos] === "*" || expr[pos] === "/")) {
        const op = expr[pos++];
        const right = parseFactor();
        left = op === "*" ? left * right : left / right;
      }
      return left;
    }
    function parseFactor(): number {
      if (expr[pos] === "(") {
        pos++; // skip (
        const val = parseExpr();
        pos++; // skip )
        return val;
      }
      if (expr[pos] === "-") {
        pos++;
        return -parseFactor();
      }
      const start = pos;
      while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;
      if (pos === start) throw new Error("Unexpected token");
      return parseFloat(expr.slice(start, pos));
    }
    return parseExpr();
  }

  // Record expense — persists to the real ledger (Expense table), read
  // back by the Expense Report.
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseAmount) return;

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expenseCategory,
          amount: Number(expenseAmount),
          details: expenseNote || undefined,
        }),
      });
      const body = await res.json();
      if (body.success) {
        setIsExpenseOpen(false);
        setExpenseAmount("");
        setExpenseNote("");
        triggerAlert("success", "Expense logged successfully.");
      } else {
        triggerAlert("error", body.error?.message ?? "Failed to log expense");
      }
    } catch (err) {
      triggerAlert("error", "Failed to contact server.");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 overflow-hidden">
      
      {/* ────────────────────────────────────────────────────────────────── */}
      {/* TOP HEADER BAR */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3 border-b shadow-sm dark:bg-zinc-950 dark:border-zinc-800">
        
        {/* Left: Location & Time */}
        <div className="flex items-center gap-4">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-sm font-bold hover:bg-zinc-100 dark:border-zinc-850 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition">
            <Home className="h-4 w-4 text-indigo-500" />
            Dashboard
          </Link>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <MapPin className="h-4.5 w-4.5 text-indigo-500" />
            <span>Location: <span className="text-zinc-900 dark:text-white">Mektas Supers</span></span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{currentTime || "06-08-2026 06:56"}</span>
          </div>
          <RegisterStatusBar />
        </div>

        {/* Center/Right: Actions Bar */}
        <div className="flex items-center gap-1.5">
          {/* Recent Trans History */}
          <button
            onClick={() => {
              fetchRecentTransactions();
              setIsRecentModalOpen(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-650 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition"
            title="Recent Completed Sales"
          >
            <History className="h-4 w-4" />
          </button>
          
          {/* calculator */}
          <button
            onClick={() => setIsCalculatorOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-650 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition"
            title="Calculator"
          >
            <Calculator className="h-4 w-4" />
          </button>

          {/* Held Carts / Resume Drawer button */}
          <button
            onClick={() => {
              fetchHeldCarts();
              setIsHeldModalOpen(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-650 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition"
            title="Resumable Held Sales"
          >
            <Briefcase className="h-4 w-4" />
          </button>

          {/* Hard reset */}
          <button
            onClick={() => {
              clear();
              triggerAlert("success", "Cart cleared.");
            }}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-650 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition"
            title="Hard reset cart"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Divider */}
          <span className="mx-1 h-6 border-l border-zinc-350 dark:border-zinc-800"></span>

          {/* Add Expense button */}
          <button
            onClick={() => setIsExpenseOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-sm font-bold hover:bg-zinc-100 dark:border-zinc-850 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-500" />
            Add Expense
          </button>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* ALERT BANNERS */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {/* ── Fixed toast notification (bottom-right) — NO layout shift ────────
          Previously this was an inline block between the header and main,
          causing every cart action to shift the entire page content up/down.
          Fixed-position overlay eliminates the CLS entirely. */}
      {alertMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-semibold shadow-xl ring-1 animate-slide-up ${
          alertMsg.type === "success"
            ? "bg-green-600 text-white ring-green-700/50"
            : "bg-red-600 text-white ring-red-700/50"
        }`}>
          {alertMsg.type === "success" ? (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          )}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* MAIN LAYOUT SPLIT */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0">
        {/* Left Side: Invoice Panel */}
        <div className="w-full md:w-[60%] flex flex-col min-h-0">
          <CartPanel products={products} calculation={calculation} />
        </div>

        {/* Right Side: Product search grid */}
        <div className="w-full md:w-[40%] flex flex-col min-h-0">
          <ProductSearch products={products} />
        </div>
      </main>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* FOOTER ACTION BAR */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <footer className="sticky bottom-0 bg-white border-t p-4 flex flex-wrap items-center justify-between gap-4 shadow-md dark:bg-zinc-950 dark:border-zinc-800">
        
        {/* Left Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => {
              fetchRecentTransactions();
              setIsRecentModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 transition"
          >
            <History className="h-3.5 w-3.5" />
            Recent Transactions
          </button>
          
          <button
            onClick={() => handleHoldCart("draft")}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-bold hover:bg-zinc-50 text-zinc-650 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:text-zinc-400 transition"
          >
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            Draft
          </button>

          <button
            onClick={() => handleHoldCart("suspended")}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-bold hover:bg-zinc-50 text-zinc-650 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:text-zinc-400 transition"
          >
            <Pause className="h-3.5 w-3.5 text-zinc-500" />
            Suspend
          </button>
        </div>

        {/* Center & Right Actions */}
        <div className="flex items-center flex-wrap gap-4">
          
          {/* Cancel Button */}
          <button
            onClick={() => {
              clear();
              triggerAlert("success", "Transaction cancelled.");
            }}
            className="h-10 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-bold text-white transition flex items-center gap-1"
          >
            <XCircle className="h-4.5 w-4.5" />
            Cancel
          </button>

          {/* Total Payable display */}
          <div className="text-zinc-800 dark:text-zinc-200">
            <span className="text-sm uppercase font-bold text-zinc-450 dark:text-zinc-500">Total Payable:</span>
            <p className="text-xl font-extrabold font-mono leading-none mt-0.5">Rs {totalPayable.toFixed(2)}</p>
          </div>

          {/* Pay Button */}
          <button
            disabled={lines.length === 0}
            onClick={() => setIsPaymentOpen(true)}
            className="h-10 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard className="h-4.5 w-4.5" />
            {lines.length > 0 ? `Pay Rs ${totalPayable.toFixed(2)}` : "Pay"}
          </button>
        </div>

      </footer>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* POPUP OVERLAY MODALS */}
      {/* ────────────────────────────────────────────────────────────────── */}

      {/* Payment Overlay Modal */}
      <PaymentModal
        open={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        total={totalPayable}
        totalItems={totalItems}
        calculationPayload={calculation}
      />

      {/* Suspended/Draft Carts Drawer */}
      <Modal open={isHeldModalOpen} onClose={() => setIsHeldModalOpen(false)} title="Resumable Held Sales">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {heldCarts.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">No held sales found.</p>
          ) : (
            heldCarts.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 rounded-md border p-3 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                    c.type === "suspended" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400" : "bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400"
                  }`}>
                    {c.type}
                  </span>
                  <span className="text-xs text-zinc-400">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs space-y-1">
                  <p><strong>Customer:</strong> {c.customer?.name ?? "Walk-In Customer"}</p>
                  <p><strong>Items:</strong> {Array.isArray(c.lines) ? c.lines.reduce((sum: number, l: any) => sum + (l.qty || 0), 0) : 0}</p>
                  <p><strong>Total:</strong> Rs {c.shipping + (Array.isArray(c.lines) ? c.lines.reduce((sum: number, l: any) => sum + (l.qty * l.unitPrice), 0) : 0)}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleResumeCart(c)}
                    className="flex-1 rounded bg-indigo-600 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => handleDeleteHeldCart(c.id)}
                    className="rounded bg-zinc-100 p-1 text-red-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Recent Transactions List */}
      <Modal open={isRecentModalOpen} onClose={() => setIsRecentModalOpen(false)} title="Recent Completed Sales">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {recentTxs.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">No recent sales found.</p>
          ) : (
            recentTxs.map((tx) => (
              <div key={tx.id} className="flex flex-col gap-2 rounded-md border p-3 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold font-mono text-indigo-600 dark:text-indigo-400">{tx.id}</span>
                  <span className="text-xs text-zinc-400">{new Date(tx.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="text-xs flex items-center justify-between">
                  <div>
                    <p><strong>Customer:</strong> {tx.customer?.name ?? "Walk-In"}</p>
                    <p><strong>Method:</strong> <span className="capitalize">{tx.paymentMethod}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-805 dark:text-white">Rs {Number(tx.total).toFixed(2)}</p>
                    <p className="text-xs text-zinc-400">{tx.items.length} items</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Calculator Modal */}
      <Modal open={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} title="Calculator">
        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-zinc-50 p-3 text-right dark:bg-zinc-900">
            <p className="text-xs text-zinc-400 min-h-[1rem] font-mono">{calcInput || "0"}</p>
            <p className="text-2xl font-bold font-mono min-h-[2rem]">{calcResult || "0"}</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-sm font-semibold">
            {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "C", "0", "=", "+"].map((char) => (
              <button
                key={char}
                onClick={() => handleCalcPress(char)}
                className={`h-10 rounded border hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${
                  char === "=" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""
                } ${char === "C" ? "text-red-500 hover:text-red-650" : ""}`}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Add Expense Modal */}
      <Modal open={isExpenseOpen} onClose={() => setIsExpenseOpen(false)} title="Add Expense">
        <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Amount:*</label>
            <input
              required
              type="number"
              min={0}
              placeholder="0.00"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Category:*</label>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 bg-transparent px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="rent">Rent/Utilities</option>
              <option value="salaries">Staff Salaries</option>
              <option value="inventory">Supplies/Inventory</option>
              <option value="petty_cash">Petty Cash</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500">Note:</label>
            <textarea
              placeholder="Expense description..."
              value={expenseNote}
              onChange={(e) => setExpenseNote(e.target.value)}
              rows={2}
              className="rounded border border-zinc-300 bg-transparent p-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1">Save Expense</Button>
            <Button type="button" variant="outline" onClick={() => setIsExpenseOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
