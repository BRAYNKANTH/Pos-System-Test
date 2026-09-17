import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasElevatedAccess } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  editInvoiceLines,
  TransactionNotFoundError,
  InvoiceNotEditableError,
  TrackedLineNotEditableError,
  LineNotFoundError,
} from "@/lib/bills/editInvoice";
import { InsufficientStockError } from "@/lib/inventory/stock";

// PATCH /api/bills/[id] — direct invoice correction. Admin-only (not
// Manager/Cashier — this is a stronger action than the manager-card
// override pattern used elsewhere, since it rewrites an already-locked
// financial record after the fact) and requires the same elevated
// re-auth window as other sensitive admin actions (see
// /api/auth/admin-reauth) — being logged in as an admin isn't itself
// enough to silently correct a past invoice.
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (user.role !== "ADMIN") {
    return apiError("FORBIDDEN", "Only an Admin can edit an invoice directly", { status: 403 });
  }
  if (!(await hasElevatedAccess(user.id))) {
    return apiError("REAUTH_REQUIRED", "Re-enter your password to edit this invoice", { status: 403 });
  }

  const { id: billId } = await props.params;
  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const updates = Array.isArray(body?.updates)
    ? body.updates
        .map((u: { id?: unknown; qty?: unknown; unitPrice?: unknown; discount?: unknown }) => ({
          id: String(u?.id ?? ""),
          qty: Number(u?.qty),
          unitPrice: Number(u?.unitPrice),
          discount: Number(u?.discount) || 0,
        }))
        .filter((u: { id: string }) => u.id)
    : [];
  const removeIds = Array.isArray(body?.removeIds) ? body.removeIds.map(String).filter(Boolean) : [];

  if (!reason) {
    return apiError("INVALID_INPUT", "A reason is required to edit an invoice", { status: 400 });
  }
  if (updates.length === 0 && removeIds.length === 0) {
    return apiError("INVALID_INPUT", "No changes were submitted", { status: 400 });
  }

  try {
    // The route only knows the Bill's id — editInvoiceLines works off the
    // underlying Transaction, so resolve that first.
    const bill = await prisma.bill.findUnique({ where: { id: billId }, select: { transactionId: true } });
    if (!bill) return apiError("NOT_FOUND", "Bill not found", { status: 404 });

    const updated = await editInvoiceLines({
      transactionId: bill.transactionId,
      updates,
      removeIds,
      actorId: user.id,
      reason,
    });
    return apiSuccess(updated);
  } catch (err) {
    if (err instanceof TransactionNotFoundError) return apiError("NOT_FOUND", err.message, { status: 404 });
    if (err instanceof InvoiceNotEditableError) return apiError("NOT_EDITABLE", err.message, { status: 409 });
    if (err instanceof TrackedLineNotEditableError) return apiError("TRACKED_LINE", err.message, { status: 409 });
    if (err instanceof LineNotFoundError) return apiError("LINE_NOT_FOUND", err.message, { status: 400 });
    if (err instanceof InsufficientStockError) return apiError("INSUFFICIENT_STOCK", `Not enough stock for ${err.sku}`, { status: 409 });
    console.error("editInvoiceLines failed", err);
    return apiError("EDIT_FAILED", err instanceof Error ? err.message : "Failed to edit invoice", { status: 500 });
  }
}
