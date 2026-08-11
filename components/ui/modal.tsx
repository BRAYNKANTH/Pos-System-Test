"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Modal with:
//  • Escape-key to close
//  • Focus trap (Tab cycles within the modal only)
//  • aria-modal + aria-labelledby for screen reader compatibility
//  • Backdrop click to close

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Escape key handler
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus trap — keep Tab inside the modal while it's open
  React.useEffect(() => {
    if (!open || !dialogRef.current) return;

    const el = dialogRef.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus first element on open
    first?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (focusable.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={cn(
          "w-full max-w-md rounded-xl bg-white p-6 shadow-2xl ring-1 ring-black/5 animate-scale-in dark:bg-zinc-900 dark:ring-white/10",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id={titleId} className="mb-4 text-lg font-semibold tracking-tight">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
