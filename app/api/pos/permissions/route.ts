import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/pos/permissions — the handful of permission checks the POS
// client UI needs to conditionally show controls (e.g. only managers see
// the price-override field). Keeping this as one small endpoint instead
// of exposing the whole roles_permissions table to the client.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const priceOverride = await checkPermission(user.role, PERMISSIONS.PRICE_OVERRIDE);
  return apiSuccess({ priceOverride });
}
