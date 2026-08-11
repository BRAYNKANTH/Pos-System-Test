import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// DELETE /api/pos/held-carts/:id - Delete a held cart (after resume -> checkout or cancellation)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await params;

  try {
    const heldCart = await prisma.heldCart.findFirst({
      where: { id, cashierId: user.id },
    });

    if (!heldCart) {
      return apiError("NOT_FOUND", "Held cart not found or access denied", { status: 404 });
    }

    await prisma.heldCart.delete({
      where: { id },
    });

    return apiSuccess({ id, deleted: true });
  } catch (err) {
    console.error("Failed to delete held cart", err);
    return apiError("DELETE_FAILED", "Failed to delete held cart", { status: 500 });
  }
}
