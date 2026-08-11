import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// POST /api/admin/sync-status/retry — resets every "failed" SyncQueueJob
// back to "pending" with retryCount 0, so the worker picks them up again
// on its next poll. Needed because the worker's own query
// (`retryCount: { lt: MAX_RETRIES }`) permanently skips a job once it's
// exhausted retries — a real fix landing after that point (e.g. a Zoho
// payload bug) never gets a chance to re-run those jobs on its own.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES))) {
    return apiError("FORBIDDEN", "Admin only", { status: 403 });
  }

  const result = await prisma.syncQueueJob.updateMany({
    where: { status: "failed" },
    data: { status: "pending", retryCount: 0, lastAttemptAt: null },
  });

  return apiSuccess({ reset: result.count });
}
