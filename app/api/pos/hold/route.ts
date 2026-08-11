import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// Backs both "Draft" and "Suspend" on the POS screen — a cart parked
// mid-sale. Multiple rows can exist at once (not a single slot).

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const body = await req.json().catch(() => null);
  const type = body?.type === "draft" ? "draft" : "suspended";
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  if (lines.length === 0) {
    return apiError("INVALID_INPUT", "lines[] must be non-empty", { status: 400 });
  }

  const held = await prisma.heldCart.create({
    data: {
      type,
      cashierId: user.id,
      customerId: typeof body?.customerId === "string" && body.customerId ? body.customerId : null,
      lines,
      discount: body?.discount ?? undefined,
      shipping: Number(body?.shipping) || 0,
      note: typeof body?.note === "string" && body.note ? body.note : null,
    },
  });

  return apiSuccess(held);
}

// List the current cashier's held carts (drafts + suspended, newest first).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const held = await prisma.heldCart.findMany({
    where: { cashierId: user.id },
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  return apiSuccess(
    held.map((h) => ({
      id: h.id,
      type: h.type,
      customerName: h.customer?.name ?? null,
      lineCount: Array.isArray(h.lines) ? h.lines.length : 0,
      note: h.note,
      createdAt: h.createdAt,
    })),
  );
}
