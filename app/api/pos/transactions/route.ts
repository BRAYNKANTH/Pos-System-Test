import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/pos/transactions - Get recent transactions for the logged-in cashier
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  try {
    const transactions = await prisma.transaction.findMany({
      where: { cashierId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        items: true,
        customer: true,
      },
    });

    return apiSuccess(transactions);
  } catch (err) {
    console.error("Failed to fetch recent transactions", err);
    return apiError("FETCH_FAILED", "Failed to fetch recent transactions", { status: 500 });
  }
}
