import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getRegisterSummary } from "@/lib/pos/register";

// GET /api/pos/register/:id/summary — the full reconciliation report for
// a register session (open or closed): payment-method breakdown, sales/
// refund/expense totals, and an itemized products-sold list. Backs both
// the live "Current Register" view (session still open, closedAt cutoff
// defaults to now) and the "Register Details" view shown right after
// closing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.REGISTER_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view register status", { status: 403 });
  }

  const { id } = await params;
  try {
    const summary = await getRegisterSummary(id);
    return apiSuccess(summary);
  } catch (err) {
    console.error("getRegisterSummary failed", err);
    return apiError("NOT_FOUND", "Register session not found", { status: 404 });
  }
}
