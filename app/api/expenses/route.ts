import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/expenses — recent expense ledger entries, newest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.EXPENSE_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view expenses", { status: 403 });
  }

  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return apiSuccess(expenses);
}

// POST /api/expenses — log an operating expense (rent, utilities, etc).
// Previously the "Log Expense" button on /pos only showed a success toast
// and never persisted anything — this is the real handler for it.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.EXPENSE_CREATE))) {
    return apiError("FORBIDDEN", "Not allowed to log expenses", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category : "";
  const amount = Number(body?.amount);
  const details = typeof body?.details === "string" ? body.details : "";

  if (!category || !Number.isFinite(amount) || amount <= 0) {
    return apiError("INVALID_INPUT", "category and a positive amount are required", { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      category,
      details: details || category,
      amount,
      status: "Completed",
    },
  });

  return apiSuccess(expense, { status: 201 });
}
