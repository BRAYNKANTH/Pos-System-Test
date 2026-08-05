"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Minimal dependency-free modal for the approval-queue pattern (e.g.
// "Approve/reject with elevated re-auth" in Modules 2 & 3). If a module
// needs richer behavior (focus trap, animations), swap in
// @radix-ui/react-dialog — the tech stack allows either.

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
