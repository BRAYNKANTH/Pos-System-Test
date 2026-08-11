import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// PATCH /api/admin/zoho — sets the Zoho Books Organization ID on the
// existing connection (created by the OAuth callback with this left
// blank — Zoho's org ID isn't returned by the token exchange, only found
// under Zoho Books' own Settings → Organization Profile page). Every
// sendToZoho() call needs this to target the right organization.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES))) {
    return apiError("FORBIDDEN", "Admin only", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
  if (!organizationId) {
    return apiError("INVALID_INPUT", "organizationId is required", { status: 400 });
  }

  const connection = await prisma.zohoConnection.findUnique({ where: { branchId: "default" } });
  if (!connection) {
    return apiError(
      "NOT_CONNECTED",
      "Connect to Zoho first — the connection record is created by the OAuth flow",
      { status: 409 },
    );
  }

  const updated = await prisma.zohoConnection.update({
    where: { branchId: "default" },
    data: { organizationId },
  });

  return apiSuccess({ organizationId: updated.organizationId });
}
