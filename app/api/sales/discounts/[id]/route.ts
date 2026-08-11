import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// PUT /api/sales/discounts/[id] — Update a discount
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await props.params;

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.name || !body.discountAmount) {
      return apiError("INVALID_INPUT", "Name and discount amount are required.", { status: 400 });
    }

    const updated = await prisma.discount.update({
      where: { id },
      data: {
        name: body.name,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        discountType: body.discountType,
        discountAmount: Number(body.discountAmount),
        priority: Number(body.priority) || 1,
        brand: body.brand || null,
        category: body.category || null,
        products: body.products || [], // JSON array
        location: body.location || "Mektas Supers",
        sellingPriceGroup: body.sellingPriceGroup || "All",
        applyInCustomerGroups: !!body.applyInCustomerGroups,
        isActive: body.isActive !== false,
      }
    });

    return apiSuccess(updated);
  } catch (err) {
    console.error("updateDiscount failed", err);
    return apiError("UPDATE_FAILED", "Failed to update discount in database", { status: 500 });
  }
}

// DELETE /api/sales/discounts/[id] — Delete a discount
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await props.params;

  try {
    await prisma.discount.delete({
      where: { id }
    });
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("deleteDiscount failed", err);
    return apiError("DELETE_FAILED", "Failed to delete discount from database", { status: 500 });
  }
}
