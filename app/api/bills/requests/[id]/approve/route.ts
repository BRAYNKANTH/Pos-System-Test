import { getCurrentUser, hasElevatedAccess } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { approveChangeRequest, ChangeRequestNotPendingError } from "@/lib/bills/changeRequests";
import { enqueueSyncJob } from "@/lib/sync/enqueueSyncJob";

// approveChangeRequest — POST /api/bills/requests/:id/approve — requires
// the PIN/password re-auth window from /api/auth/admin-reauth. Triggers
// audit log (inside approveChangeRequest) + Zoho re-sync (credit note).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.BILLS_APPROVE))) {
    return apiError("FORBIDDEN", "Not allowed to approve bill changes", { status: 403 });
  }
  if (!(await hasElevatedAccess(user.id))) {
    return apiError("REAUTH_REQUIRED", "Re-enter your password to approve", { status: 403 });
  }

  const { id } = await params;
  try {
    const request = await approveChangeRequest(id, user.id);
    // syncBillAdjustment — never overwrites the original transaction;
    // sends a linked credit note/adjustment instead.
    await enqueueSyncJob({
      entityType: "bill",
      entityId: request.billId,
      payload: { changeRequestId: request.id, type: request.type },
    });
    return apiSuccess(request);
  } catch (err) {
    if (err instanceof ChangeRequestNotPendingError) {
      return apiError("NOT_PENDING", err.message, { status: 409 });
    }
    console.error("approveChangeRequest failed", err);
    return apiError("APPROVE_FAILED", "Failed to approve change request", { status: 500 });
  }
}
