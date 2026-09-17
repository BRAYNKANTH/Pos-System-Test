import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { pullAllProductsFromZoho } from "@/lib/sync/zohoClient";

// POST /api/admin/sync/pull-products — the "Import Products from Zoho"
// button on /admin/sync-status. One-time/on-demand full catalog
// reconciliation; see pullAllProductsFromZoho's own docs in
// lib/sync/zohoClient.ts for what it creates/updates/removes.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES))) {
    return apiError("FORBIDDEN", "Admin only", { status: 403 });
  }

  try {
    const result = await pullAllProductsFromZoho(user.id);
    return apiSuccess(result);
  } catch (err) {
    console.error("pullAllProductsFromZoho failed", err);
    return apiError("PULL_FAILED", err instanceof Error ? err.message : "Failed to pull products from Zoho", { status: 500 });
  }
}
