import { getCurrentUser, hasElevatedAccess } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { approveAdjustment, AdjustmentNotPendingError, InsufficientStockError } from "@/lib/inventory/stock";

// approveAdjustment — POST /api/inventory/adjustments/:id/approve —
// requires the PIN/password re-auth window from /api/auth/admin-reauth
// (same "any mutation of a pending approval needs elevated access" rule
// used for bill-change approvals too).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_APPROVE))) {
    return apiError("FORBIDDEN", "Not allowed to approve inventory adjustments", { status: 403 });
  }
  if (!(await hasElevatedAccess(user.id))) {
    return apiError("REAUTH_REQUIRED", "Re-enter your password to approve", { status: 403 });
  }

  const { id } = await params;
  try {
    // Zoho sync is now enqueued inside approveAdjustment itself (lib/
    // inventory/stock.ts) — every path that actually applies a stock
    // change syncs from one place, not scattered per-route.
    const adjustment = await approveAdjustment(id, user.id);
    return apiSuccess(adjustment);
  } catch (err) {
    if (err instanceof AdjustmentNotPendingError) {
      return apiError("NOT_PENDING", err.message, { status: 409 });
    }
    if (err instanceof InsufficientStockError) {
      return apiError("INSUFFICIENT_STOCK", err.message, { status: 409 });
    }
    console.error("approveAdjustment failed", err);
    return apiError("APPROVE_FAILED", "Failed to approve adjustment", { status: 500 });
  }
}
