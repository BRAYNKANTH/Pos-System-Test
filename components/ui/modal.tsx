"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
export interface ModalProps {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode;
  className?: string; unstyled?: boolean; closeDisabled?: boolean;
}
/** Native dialogs keep the background inert, contain dynamic focus and restore it on close. */
export function Modal({ open, onClose, title = "Dialog", children, className, unstyled, closeDisabled }: ModalProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);
  return <dialog ref={ref} aria-labelledby={titleId} aria-busy={closeDisabled || undefined}
    onCancel={(e) => { e.preventDefault(); if (!closeDisabled) onClose(); }}
    className={cn("pos-dialog m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl bg-white p-0 text-zinc-900 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100", unstyled && "max-w-fit bg-transparent shadow-none", className)}>
    {open && <fieldset disabled={closeDisabled} className={unstyled ? "m-0 min-w-0 border-0 p-0" : "m-0 min-w-0 border-0 p-6"}>
      <h2 id={titleId} className={unstyled ? "sr-only" : "mb-4 text-lg font-semibold"}>{title}</h2>
      {children}
    </fieldset>}
  </dialog>;
}
