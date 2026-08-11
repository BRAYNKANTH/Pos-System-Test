import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// Resume — POST /api/pos/hold/:id — returns the held cart's full contents
// for the client to reload into the cart store, then deletes the row
// (resuming "consumes" it; suspend/draft it again to re-park).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await params;
  const held = await prisma.heldCart.findUnique({ where: { id }, include: { customer: true } });
  if (!held || held.cashierId !== user.id) {
    return apiError("NOT_FOUND", "Held cart not found", { status: 404 });
  }

  await prisma.heldCart.delete({ where: { id } });

  return apiSuccess({
    lines: held.lines,
    discount: held.discount,
    shipping: held.shipping ? Number(held.shipping) : 0,
    customerId: held.customerId,
    customerName: held.customer?.name ?? null,
  });
}

// Discard — DELETE /api/pos/hold/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await params;
  const held = await prisma.heldCart.findUnique({ where: { id } });
  if (!held || held.cashierId !== user.id) {
    return apiError("NOT_FOUND", "Held cart not found", { status: 404 });
  }

  await prisma.heldCart.delete({ where: { id } });
  return apiSuccess({ discarded: true });
}
