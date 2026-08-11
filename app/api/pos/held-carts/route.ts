import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { Prisma } from "@prisma/client";

// POST /api/pos/held-carts - Hold a cart as "draft" or "suspended"
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const body = await req.json().catch(() => null);
  const type = typeof body?.type === "string" ? body.type : "draft"; // draft | suspended
  const customerId = typeof body?.customerId === "string" && body.customerId ? body.customerId : null;
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  const discount = body?.discount || null;
  const shipping = Number(body?.shipping) || 0;
  const note = typeof body?.note === "string" ? body.note : null;

  if (lines.length === 0) {
    return apiError("INVALID_INPUT", "Cart cannot be empty to hold", { status: 400 });
  }

  try {
    const heldCart = await prisma.heldCart.create({
      data: {
        type,
        cashierId: user.id,
        customerId,
        lines: lines as Prisma.InputJsonValue,
        discount: discount as Prisma.InputJsonValue,
        shipping,
        note,
      },
    });
    return apiSuccess(heldCart);
  } catch (err) {
    console.error("Failed to hold cart", err);
    return apiError("HOLD_FAILED", "Failed to hold cart. Please try again.", { status: 500 });
  }
}

// GET /api/pos/held-carts - Get all held carts for the current cashier
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  try {
    const carts = await prisma.heldCart.findMany({
      where: { cashierId: user.id },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess(carts);
  } catch (err) {
    console.error("Failed to fetch held carts", err);
    return apiError("FETCH_FAILED", "Failed to fetch held carts", { status: 500 });
  }
}
