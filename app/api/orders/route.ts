import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// Not in the original build plan's function list (only updateOrderStatus
// is) — this is the minimal create endpoint needed for the order tracker
// page to have anything to track. Marked Could-priority (restaurant/
// service use) in docs/POS_Detailed_Build_Plan.md.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const body = await req.json().catch(() => null);
  const customerId = typeof body?.customerId === "string" ? body.customerId : "";
  if (!customerId) return apiError("INVALID_INPUT", "customerId is required", { status: 400 });

  try {
    const order = await prisma.order.create({ data: { customerId, status: "pending" } });
    return apiSuccess(order);
  } catch (err) {
    console.error("create order failed", err);
    return apiError("CREATE_FAILED", "Failed to create order (check customerId)", { status: 400 });
  }
}
