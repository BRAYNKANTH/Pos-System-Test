import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { submitChangeRequest, BillNotFoundError, type ChangeRequestType } from "@/lib/bills/changeRequests";

const VALID_TYPES: ChangeRequestType[] = ["correction", "refund", "void"];

// submitChangeRequest — POST /api/bills/:id/request-change
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.BILLS_REQUEST_CHANGE))) {
    return apiError("FORBIDDEN", "Not allowed to request bill changes", { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const type = body?.type as ChangeRequestType;
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const proposedChanges = body?.proposedChanges ?? {};

  if (!VALID_TYPES.includes(type) || !reason) {
    return apiError("INVALID_INPUT", "type (correction/refund/void) and reason are required", {
      status: 400,
    });
  }

  try {
    const request = await submitChangeRequest({
      billId: id,
      requestedBy: user.id,
      type,
      reason,
      proposedChanges,
    });
    return apiSuccess(request);
  } catch (err) {
    if (err instanceof BillNotFoundError) {
      return apiError("NOT_FOUND", err.message, { status: 404 });
    }
    console.error("submitChangeRequest failed", err);
    return apiError("REQUEST_FAILED", "Failed to submit change request", { status: 500 });
  }
}
