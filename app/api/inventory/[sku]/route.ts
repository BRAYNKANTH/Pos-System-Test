import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { enqueueSyncJob } from "@/lib/sync/enqueueSyncJob";

// GET /api/inventory/[sku] - Fetch a single product's full record, for the
// Edit Product form to prefill from (list/search views only carry the
// subset of fields they display, not the complete record).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { sku } = await params;
  if (!sku) {
    return apiError("INVALID_INPUT", "SKU is required", { status: 400 });
  }

  const item = await prisma.inventoryItem.findUnique({ where: { sku } });
  if (!item) {
    return apiError("NOT_FOUND", `Product "${sku}" not found`, { status: 404 });
  }

  return apiSuccess(item);
}

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
  } catch (err) {
    console.error("Failed to delete product", err);

    // Check for Prisma foreign key constraint code (P2003)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
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
  // null (not just undefined) is a valid, meaningful value for these two —
  // "clear the category/brand" — so both must be distinguished from "the
  // caller didn't send this field at all".
  const category = typeof body?.category === "string" || body?.category === null ? body.category : undefined;
  const brand = typeof body?.brand === "string" || body?.brand === null ? body.brand : undefined;
  const lowStockThreshold = body?.lowStockThreshold !== undefined ? Number(body.lowStockThreshold) : undefined;
  const isScaleItem = typeof body?.isScaleItem === "boolean" ? body.isScaleItem : undefined;
  const isReturnable = typeof body?.isReturnable === "boolean" ? body.isReturnable : undefined;
  const trackSerial = typeof body?.trackSerial === "boolean" ? body.trackSerial : undefined;
  const trackBatch = typeof body?.trackBatch === "boolean" ? body.trackBatch : undefined;
  const isNetPriceItem = typeof body?.isNetPriceItem === "boolean" ? body.isNetPriceItem : undefined;

  try {
    // Turning batch/serial tracking ON for a product that already has
    // untracked stock on hand would leave that existing stock with no
    // batch/serial records at all — the very next sale of it would either
    // fail outright (batches.ts's deductBatchStock has nothing to draw
    // from) or, for serials, have no registered numbers to assign.
    // Require the product to be emptied out first, then bring stock back
    // in through Receive Stock (which does capture batch/serial data).
    if (trackSerial === true || trackBatch === true) {
      const current = await prisma.inventoryItem.findUnique({ where: { sku }, select: { qtyOnHand: true, trackSerial: true, trackBatch: true } });
      const turningOnSerial = trackSerial === true && !current?.trackSerial;
      const turningOnBatch = trackBatch === true && !current?.trackBatch;
      if ((turningOnSerial || turningOnBatch) && current && current.qtyOnHand > 0) {
        return apiError(
          "STOCK_NOT_EMPTY",
          `${sku} has ${current.qtyOnHand} unit(s) on hand with no batch/serial records — reduce stock to 0 first (e.g. a stock-take adjustment), then enable tracking and receive stock again.`,
          { status: 409 },
        );
      }
    }

    const updated = await prisma.inventoryItem.update({
      where: { sku },
      data: {
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(brand !== undefined && { brand }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold }),
        ...(isScaleItem !== undefined && { isScaleItem }),
        ...(isReturnable !== undefined && { isReturnable }),
        ...(trackSerial !== undefined && { trackSerial }),
        ...(trackBatch !== undefined && { trackBatch }),
        ...(isNetPriceItem !== undefined && { isNetPriceItem }),
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
  } catch (err) {
    console.error("Failed to update product", err);
    return apiError("UPDATE_FAILED", "Failed to update product.", { status: 500 });
  }
}
