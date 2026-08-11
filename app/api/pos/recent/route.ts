import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// Recent Transactions quick-access panel — last 10 sales rung up by the
// current cashier today.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const transactions = await prisma.transaction.findMany({
    where: { cashierId: user.id, createdAt: { gte: startOfDay } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { bill: true },
  });

  return apiSuccess(
    transactions.map((t) => ({
      id: t.id,
      total: Number(t.total),
      paymentMethod: t.paymentMethod,
      status: t.status,
      billId: t.bill?.id ?? null,
      createdAt: t.createdAt,
    })),
  );
}
