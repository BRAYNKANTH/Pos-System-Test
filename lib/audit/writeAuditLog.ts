import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Used by bill-change and inventory-adjustment approvals, read by
// /reports/audit. Append-only — never call prisma.auditLog.update/delete
// directly anywhere else in the codebase. Shape matches
// docs/api-contracts.md → AuditLogEntry.

export async function writeAuditLog(
  params: {
    entityType: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    actorId: string;
    approverId?: string | null;
    reason?: string | null;
  },
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  return client.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: (params.oldValue ?? null) as Prisma.InputJsonValue,
      newValue: (params.newValue ?? null) as Prisma.InputJsonValue,
      actorId: params.actorId,
      approverId: params.approverId ?? null,
      reason: params.reason ?? null,
    },
  });
}
