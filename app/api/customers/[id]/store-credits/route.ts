import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getAvailableStoreCredit, issueStoreCredit } from "@/lib/customers/storeCredit";

// GET /api/customers/[id]/store-credits — a customer's credit notes plus
// their total spendable balance. Any logged-in user can read this — like
// /api/inventory/[sku]/batches, it's data a cashier needs at checkout
// (the POS payment modal's "Store Credit" tender), not an admin-only view.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return apiError("NOT_FOUND", "Customer not found", { status: 404 });

  const credits = await prisma.storeCredit.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "desc" },
    include: { sourceReturn: { select: { id: true, transactionId: true } } },
  });

  return apiSuccess({
    availableBalance: await getAvailableStoreCredit(id),
    credits: credits.map((c) => ({
      id: c.id,
      amount: Number(c.amount),
      remainingAmount: Number(c.remainingAmount),
      status: c.status,
      reason: c.reason,
      sourceReturnId: c.sourceReturnId,
      sourceTransactionId: c.sourceReturn?.transactionId ?? null,
      createdAt: c.createdAt,
    })),
  });
}

// POST /api/customers/[id]/store-credits — manually issue a credit note
// (goodwill gesture, price dispute adjustment) not tied to a sales
// return. Gated by CUSTOMER_CREDIT_MANAGE — issuing one from an actual
// return instead goes through /api/sales/returns, gated by
// SALES_RETURN_CREATE.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.CUSTOMER_CREDIT_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to issue store credit", { status: 403 });
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return apiError("NOT_FOUND", "Customer not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!Number.isFinite(amount) || amount <= 0) {
    return apiError("INVALID_INPUT", "amount must be a positive number", { status: 400 });
  }
  if (!reason) {
    return apiError("INVALID_INPUT", "A reason is required to issue store credit", { status: 400 });
  }

  const credit = await prisma.$transaction((tx) =>
    issueStoreCredit(tx, { customerId: id, amount, reason, createdById: user.id }),
  );

  return apiSuccess(
    { id: credit.id, amount: Number(credit.amount), remainingAmount: Number(credit.remainingAmount) },
    { status: 201 },
  );
}
