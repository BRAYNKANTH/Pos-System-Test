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
    await enqueueSyncJob({
      entityType: "transaction",
      entityId: transaction.id,
      payload: { transactionId: transaction.id, status: "voided" },
    });
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
