import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { enqueueSyncJob } from "@/lib/sync/enqueueSyncJob";

// DELETE /api/inventory/[sku] - Delete a product
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to delete products", { status: 403 });
  }

  const { sku } = await params;
  if (!sku) {
    return apiError("INVALID_INPUT", "SKU is required", { status: 400 });
  }

  try {
    // Delete the product inside a transaction
    await prisma.$transaction(async (tx) => {
      // Delete any associated stock adjustments first (they are set to Cascade or can be deleted)
      await tx.stockAdjustment.deleteMany({ where: { sku } });

      // Delete the product
      await tx.inventoryItem.delete({ where: { sku } });
    });

    return apiSuccess({ message: `Product "${sku}" deleted successfully.` });
  } catch (err: any) {
    console.error("Failed to delete product", err);

    // Check for Prisma foreign key constraint code (P2003)
    if (err.code === "P2003") {
      return apiError(
        "FOREIGN_KEY_RESTRICTION",
        "This product is referenced in sales history and cannot be deleted. Please mark it as 'Not for selling' instead.",
        { status: 409 }
      );
    }

    return apiError("DELETE_FAILED", "Failed to delete product. Please try again.", { status: 500 });
  }
}

// PATCH /api/inventory/[sku] - Update a product (e.g. unit price, purchase price)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to edit products", { status: 403 });
  }

  const { sku } = await params;
  if (!sku) {
    return apiError("INVALID_INPUT", "SKU is required", { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const purchasePrice = body?.purchasePrice !== undefined ? Number(body.purchasePrice) : undefined;
  const unitPrice = body?.unitPrice !== undefined ? Number(body.unitPrice) : undefined;
  const name = typeof body?.name === "string" ? body.name : undefined;

  try {
    const updated = await prisma.inventoryItem.update({
      where: { sku },
      data: {
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(name !== undefined && { name }),
      },
    });

    // Only push to Zoho when something Zoho actually cares about changed
    // (name/price) — this route is also used for purchase-price-only
    // edits that don't need a round trip.
    if (unitPrice !== undefined || name !== undefined) {
      await enqueueSyncJob({
        entityType: "inventory_item",
        entityId: updated.id,
        payload: { sku: updated.sku, name: updated.name },
      });
    }

    return apiSuccess(updated);
  } catch (err: any) {
    console.error("Failed to update product", err);
    return apiError("UPDATE_FAILED", "Failed to update product.", { status: 500 });
  }
}
