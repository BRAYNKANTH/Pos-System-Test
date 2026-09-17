import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// POST /api/customers/[id]/store-credits/[creditId]/void — cancel the
// unused remainder of a credit note (issued in error, wrong amount,
// duplicate). Zeroes out remainingAmount so it can no longer be redeemed
// at checkout; whatever was already redeemed stays redeemed (see
// StoreCreditRedemption — this never touches those rows or the sale they
// paid for). Same gate as manual issuance — CUSTOMER_CREDIT_MANAGE.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; creditId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.CUSTOMER_CREDIT_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to void store credit", { status: 403 });
  }

  const { id, creditId } = await params;
  const credit = await prisma.storeCredit.findUnique({ where: { id: creditId } });
  if (!credit || credit.customerId !== id) {
    return apiError("NOT_FOUND", "Credit note not found", { status: 404 });
  }
  if (credit.status === "void") {
    return apiError("ALREADY_VOID", "This credit note is already void", { status: 409 });
  }

  const updated = await prisma.storeCredit.update({
    where: { id: creditId },
    data: { remainingAmount: 0, status: "void" },
  });

  return apiSuccess({ id: updated.id, status: updated.status });
}
