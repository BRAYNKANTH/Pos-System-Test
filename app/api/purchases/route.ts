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
// the Purchase + PurchaseItem rows, registers any new products on the fly if needed,
// increases InventoryItem.qtyOnHand for each line, and credits the receiving
// location's LocationStock breakdown, all in one atomic transaction.
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
        sku: typeof i?.sku === "string" ? i.sku.trim() : "",
        name: typeof i?.name === "string" ? i.name.trim() : "",
        category: typeof i?.category === "string" ? i.category.trim() : undefined,
        brand: typeof i?.brand === "string" ? i.brand.trim() : undefined,
        unitPrice: Number.isFinite(Number(i?.unitPrice)) ? Number(i.unitPrice) : undefined,
        unitCost: Number(i?.unitCost),
        qty: Number(i?.qty),
        isNewProduct: Boolean(i?.isNewProduct),
      };
    })
    .filter(
      (i) =>
        (i.sku || i.name || i.isNewProduct) &&
        Number.isFinite(i.qty) &&
        i.qty > 0 &&
        Number.isFinite(i.unitCost) &&
        i.unitCost >= 0
    );

  if (!supplierId) return apiError("INVALID_INPUT", "supplierId is required", { status: 400 });
  if (items.length === 0) {
    return apiError("INVALID_INPUT", "At least one valid line item (qty > 0, unitCost >= 0) is required", {
      status: 400,
    });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return apiError("UNKNOWN_SUPPLIER", "Supplier not found", { status: 400 });

  const receivingLocation = locationId
    ? await prisma.location.findUnique({ where: { id: locationId } })
    : await prisma.location.findFirst({ where: { isDefault: true } });
  if (!receivingLocation) {
    return apiError("NO_LOCATION", "No receiving location configured", { status: 400 });
  }

  const totalAmount = items.reduce((sum, i) => sum + i.qty * i.unitCost, 0);
  const amountPaid = Number.isFinite(Number(body?.amountPaid)) ? Number(body.amountPaid) : totalAmount;

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      // 1. Resolve / Create products for all line items
      const resolvedItems: { sku: string; qty: number; unitCost: number }[] = [];

      for (const item of items) {
        let sku = item.sku;

        // Find if SKU exists
        let existingItem = sku ? await tx.inventoryItem.findUnique({ where: { sku } }) : null;

        // If product does not exist or user flagged as new product
        if (!existingItem) {
          if (!sku) {
            // Auto-generate unique SKU
            let isUnique = false;
            let attempts = 0;
            while (!isUnique && attempts < 10) {
              const generated = "SKU-" + Math.floor(100000 + Math.random() * 900000);
              const exists = await tx.inventoryItem.findUnique({ where: { sku: generated } });
              if (!exists) {
                sku = generated;
                isUnique = true;
              }
              attempts++;
            }
            if (!sku) {
              throw new Error("Failed to auto-generate SKU for new product.");
            }
          }

          const productName = item.name || sku;
          const sellingPrice = item.unitPrice ?? Number((item.unitCost * 1.3).toFixed(2));

          existingItem = await tx.inventoryItem.create({
            data: {
              sku,
              name: productName,
              category: item.category || null,
              brand: item.brand || null,
              purchasePrice: item.unitCost,
              unitPrice: sellingPrice,
              qtyOnHand: 0, // Stock will be credited in next step
            },
          });
        } else if (item.unitCost > 0) {
          // Update purchasePrice for existing item if cost changed
          await tx.inventoryItem.update({
            where: { sku },
            data: { purchasePrice: item.unitCost },
          });
        }

        resolvedItems.push({
          sku,
          qty: item.qty,
          unitCost: item.unitCost,
        });
      }

      // 2. Create Purchase record
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
            create: resolvedItems.map((i) => ({
              sku: i.sku,
              qty: i.qty,
              unitCost: i.unitCost,
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      // 3. Auto-add received stock for each product
      for (const i of resolvedItems) {
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
    return apiError("CREATE_FAILED", err instanceof Error ? err.message : "Failed to record purchase", { status: 500 });
  }
}
