import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// getAuditReport — GET /api/reports/audit?filters= — pulls from audit_log
// (written by Modules 2 & 3), filterable. Supported query params:
// entityType, actorId, from, to (ISO dates).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.REPORTS_AUDIT_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view the audit report", { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const entityType = params.get("entityType") ?? undefined;
  const actorId = params.get("actorId") ?? undefined;
  const from = params.get("from");
  const to = params.get("to");

  const entries = await prisma.auditLog.findMany({
    where: {
      entityType: entityType || undefined,
      actorId: actorId || undefined,
      timestamp: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { timestamp: "desc" },
    take: 200,
    include: { actor: true, approver: true },
  });

  return apiSuccess(
    entries.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      oldValue: e.oldValue,
      newValue: e.newValue,
      actor: e.actor.name,
      approver: e.approver?.name ?? null,
      reason: e.reason,
      timestamp: e.timestamp,
    })),
  );
}
