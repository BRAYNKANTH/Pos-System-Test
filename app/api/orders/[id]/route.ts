import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

const VALID_STATUSES = ["pending", "preparing", "fulfilled", "refunded"];

// updateOrderStatus — PATCH /api/orders/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return apiError("INVALID_INPUT", `status must be one of ${VALID_STATUSES.join(", ")}`, {
      status: 400,
    });
  }

  try {
    const order = await prisma.order.update({ where: { id }, data: { status } });
    return apiSuccess(order);
  } catch (err) {
    console.error("updateOrderStatus failed", err);
    return apiError("NOT_FOUND", "Order not found", { status: 404 });
  }
}
