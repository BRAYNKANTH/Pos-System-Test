import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { creditLocationStock } from "@/lib/inventory/locationStock";

// GET /api/purchases — list, newest first, with supplier + line items.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.PURCHASE_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view purchases", { status: 403 });
  }

  const purchases = await prisma.purchase.findMany({
    include: { supplier: true, items: true, location: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return apiSuccess(purchases);
}

// POST /api/purchases — record a goods-received purchase order: creates
// the Purchase + PurchaseItem rows, increases InventoryItem.qtyOnHand for
// each line (system-wide total — same mechanism as the standalone
// "Receive Stock" action), and credits the receiving location's
// LocationStock breakdown, all in one transaction.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.PURCHASE_CREATE))) {
    return apiError("FORBIDDEN", "Not allowed to create purchases", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const supplierId = typeof body?.supplierId === "string" ? body.supplierId : "";
  const paymentMethod = typeof body?.paymentMethod === "string" ? body.paymentMethod : "cash";
  const locationId = typeof body?.locationId === "string" && body.locationId ? body.locationId : undefined;
  const referenceNo =
    typeof body?.referenceNo === "string" && body.referenceNo.trim()
      ? body.referenceNo.trim()
      : `PO-${Date.now()}`;
  const rawItems: unknown[] = Array.isArray(body?.items) ? body.items : [];

  const items = rawItems
    .map((raw) => {
      const i = raw as Record<string, unknown>;
      return {
        sku: typeof i?.sku === "string" ? i.sku : "",
        qty: Number(i?.qty),
        unitCost: Number(i?.unitCost),
      };
    })
    .filter((i) => i.sku && Number.isFinite(i.qty) && i.qty > 0 && Number.isFinite(i.unitCost) && i.unitCost >= 0);

  if (!supplierId) return apiError("INVALID_INPUT", "supplierId is required", { status: 400 });
  if (items.length === 0) {
    return apiError("INVALID_INPUT", "At least one valid line item (sku, qty > 0, unitCost >= 0) is required", {
      status: 400,
    });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return apiError("UNKNOWN_SUPPLIER", "Supplier not found", { status: 400 });

  const skus = items.map((i: { sku: string }) => i.sku);
  const knownItems = await prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });
  const knownSkuSet = new Set(knownItems.map((i) => i.sku));
  const unknownSku = skus.find((s: string) => !knownSkuSet.has(s));
  if (unknownSku) {
    return apiError("UNKNOWN_SKU", `Unknown SKU: ${unknownSku}`, { status: 400 });
  }

  const receivingLocation = locationId
    ? await prisma.location.findUnique({ where: { id: locationId } })
    : await prisma.location.findFirst({ where: { isDefault: true } });
  if (!receivingLocation) {
    return apiError("NO_LOCATION", "No receiving location configured", { status: 400 });
  }

  const totalAmount = items.reduce((sum: number, i: { qty: number; unitCost: number }) => sum + i.qty * i.unitCost, 0);
  const amountPaid = Number.isFinite(Number(body?.amountPaid)) ? Number(body.amountPaid) : totalAmount;

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          supplierId,
          referenceNo,
          paymentMethod,
          amountPaid,
          totalAmount,
          locationId: receivingLocation.id,
          createdById: user.id,
          status: "Completed",
          items: {
            create: items.map((i: { sku: string; qty: number; unitCost: number }) => ({
              sku: i.sku,
              qty: i.qty,
              unitCost: i.unitCost,
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      for (const i of items) {
        await tx.inventoryItem.update({
          where: { sku: i.sku },
          data: { qtyOnHand: { increment: i.qty } },
        });
        await tx.stockAdjustment.create({
          data: {
            sku: i.sku,
            qtyChange: i.qty,
            type: "automated",
            reasonCategory: "purchase",
            status: "applied",
          },
        });
        await creditLocationStock(tx, receivingLocation.id, i.sku, i.qty);
      }

      return created;
    }, TRANSACTION_OPTIONS);

    return apiSuccess(purchase, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError("DUPLICATE_REFERENCE", "A purchase with that reference number already exists", { status: 409 });
    }
    console.error("Failed to create purchase", err);
    return apiError("CREATE_FAILED", "Failed to record purchase", { status: 500 });
  }
}
