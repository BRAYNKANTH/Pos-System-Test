import { getCurrentUser, hasElevatedAccess } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { voidTransaction, TransactionNotFoundError, AlreadyVoidedError } from "@/lib/bills/voidTransaction";
import { enqueueSyncJob } from "@/lib/sync/enqueueSyncJob";

// Quick void — POST /api/pos/void/:id — requires the same password
// re-auth as every other approval action (BILLS_APPROVE + elevated
// access). A fast path for an admin voiding on the spot, separate from
// the full bill-change-request approval queue.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.BILLS_APPROVE))) {
    return apiError("FORBIDDEN", "Not allowed to void sales", { status: 403 });
  }
  if (!(await hasElevatedAccess(user.id))) {
    return apiError("REAUTH_REQUIRED", "Re-enter your password to void", { status: 403 });
  }

  const { id } = await params;
  try {
    const transaction = await voidTransaction(id, user.id);

    // The original sale still syncs as an Invoice (unchanged — if that job
    // hasn't run yet, it still will, and that's fine: the credit note
    // below balances it out, which is how real bookkeeping represents a
    // "sold then voided" sale — a reversed line, not an erased one).
    await enqueueSyncJob({
      entityType: "transaction",
      entityId: transaction.id,
      payload: { transactionId: transaction.id, status: "voided" },
    });

    // Previously nothing told Zoho this sale was voided at all — the
    // invoice above would sync as if it were still a completed sale, with
    // no offsetting record. A quick void has no BillChangeRequest (that's
    // the OTHER approval path, already wired to this in
    // app/api/bills/requests/[id]/approve/route.ts), so this is the one
    // remaining gap: enqueue the same "bill" sync type, which creates a
    // Zoho credit note for the bill's full amount.
    if (transaction.billId) {
      await enqueueSyncJob({
        entityType: "bill",
        entityId: transaction.billId,
        payload: { reason: "Quick void" },
      });
    }

    return apiSuccess(transaction);
  } catch (err) {
    if (err instanceof TransactionNotFoundError) {
      return apiError("NOT_FOUND", err.message, { status: 404 });
    }
    if (err instanceof AlreadyVoidedError) {
      return apiError("ALREADY_VOIDED", err.message, { status: 409 });
    }
    console.error("voidTransaction failed", err);
    return apiError("VOID_FAILED", "Failed to void sale", { status: 500 });
  }
}
