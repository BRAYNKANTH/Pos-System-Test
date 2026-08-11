import type { NextRequest } from "next/server";
import { getCurrentUser, hasElevatedAccess } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { rejectAdjustment, AdjustmentNotPendingError } from "@/lib/inventory/stock";

// rejectAdjustment — POST /api/inventory/adjustments/:id/reject
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_REJECT))) {
    return apiError("FORBIDDEN", "Not allowed to reject inventory adjustments", { status: 403 });
  }
  if (!(await hasElevatedAccess(user.id))) {
    return apiError("REAUTH_REQUIRED", "Re-enter your password to reject", { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason : "";
  if (!reason) return apiError("INVALID_INPUT", "reason is required", { status: 400 });

  try {
    const adjustment = await rejectAdjustment(id, user.id, reason);
    return apiSuccess(adjustment);
  } catch (err) {
    if (err instanceof AdjustmentNotPendingError) {
      return apiError("NOT_PENDING", err.message, { status: 409 });
    }
    console.error("rejectAdjustment failed", err);
    return apiError("REJECT_FAILED", "Failed to reject adjustment", { status: 500 });
  }
}
