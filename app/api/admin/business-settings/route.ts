import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/admin/business-settings — the singleton settings blob (see
// BusinessSettings model comment in schema.prisma for why this is JSON
// rather than one column per field).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to view business settings", { status: 403 });
  }

  const row = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  return apiSuccess(row?.data ?? {});
}

// PATCH /api/admin/business-settings — replaces the whole settings blob
// (the settings form always submits everything at once).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage business settings", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError("INVALID_INPUT", "A settings object body is required", { status: 400 });
  }

  const row = await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { data: body },
    create: { id: "default", data: body },
  });

  // /login caches the shop name for 5 minutes (see app/login/page.tsx's
  // getCachedBizName) so the one page every logout round-trips through
  // isn't paying a live DB query on every visit — bust it immediately so
  // a rename here doesn't sit stale on the login screen for up to 5
  // minutes. { expire: 0 }, same reasoning as /api/admin/roles: this is a
  // Route Handler, not a Server Action, so the default revalidateTag
  // profile would still serve one more stale read before refreshing.
  revalidateTag("business-settings", { expire: 0 });

  return apiSuccess(row.data);
}
