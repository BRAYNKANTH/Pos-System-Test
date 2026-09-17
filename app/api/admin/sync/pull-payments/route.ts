import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { pullInvoicePayments } from "@/lib/sync/zohoClient";

// POST /api/admin/sync/pull-payments — the "Pull Payments from Zoho"
// button on /admin/sync-status. See pullInvoicePayments' own docs in
// lib/sync/zohoClient.ts for what this actually checks and records.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES))) {
    return apiError("FORBIDDEN", "Admin only", { status: 403 });
  }

  try {
    const result = await pullInvoicePayments(user.id);
    return apiSuccess(result);
  } catch (err) {
    console.error("pullInvoicePayments failed", err);
    return apiError("PULL_FAILED", err instanceof Error ? err.message : "Failed to pull payments from Zoho", { status: 500 });
  }
}
