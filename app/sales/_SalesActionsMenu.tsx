"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { VoidSaleButton } from "@/components/VoidSaleButton";

export function SalesActionsMenu({
  transactionId,
  billId,
  canVoid,
  canRequestChange,
}: {
  transactionId: string;
  billId?: string;
  canVoid: boolean;
  canRequestChange: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400"
      >
        Actions ▾
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 w-40 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <Link
            href={`/pos/receipt/${transactionId}`}
            className="block px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            View receipt
          </Link>
          {canRequestChange && billId && (
            <Link
              href={`/bills/${billId}/request-change`}
              className="block px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-amber-600 font-semibold"
            >
              Request Edit
            </Link>
          )}
          {canVoid && (
            <div className="px-3 py-1.5">
              <VoidSaleButton transactionId={transactionId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
