import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { creditDefaultLocation } from "@/lib/inventory/locationStock";

// POST /api/inventory - Create a new product (InventoryItem)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to create products", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const category = typeof body?.category === "string" ? body.category : null;
  const brand = typeof body?.brand === "string" ? body.brand : null;
  const unitPrice = Number(body?.unitPrice) || 0;
  const purchasePrice = Number(body?.purchasePrice) || 0;
  const qtyOnHand = Number(body?.qtyOnHand) || 0;
  const lowStockThreshold = Number(body?.lowStockThreshold) || 0;

  if (!name) {
    return apiError("INVALID_INPUT", "Product name is required", { status: 400 });
  }

  let sku = typeof body?.sku === "string" ? body.sku.trim() : "";
  if (!sku) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const generated = "SKU-" + Math.floor(100000 + Math.random() * 900000);
      const exists = await prisma.inventoryItem.findUnique({ where: { sku: generated } });
      if (!exists) {
        sku = generated;
        isUnique = true;
      }
      attempts++;
    }
    if (!sku) {
      return apiError("CREATE_FAILED", "Failed to auto-generate unique SKU. Please provide one manually.", { status: 500 });
    }
  } else {
    // Check if SKU already exists
    const existing = await prisma.inventoryItem.findUnique({ where: { sku } });
    if (existing) {
      return apiError("DUPLICATE_SKU", `SKU "${sku}" already exists`, { status: 409 });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create product
      const item = await tx.inventoryItem.create({
        data: {
          sku,
          name,
          category,
          brand,
          unitPrice,
          purchasePrice,
          qtyOnHand,
          lowStockThreshold,
        },
      });

      // If initial stock is provided, record an automated stock adjustment
      // and credit the default location's breakdown to match.
      if (qtyOnHand > 0) {
        await tx.stockAdjustment.create({
          data: {
            sku,
            qtyChange: qtyOnHand,
            type: "automated",
            reasonCategory: "goods_receipt",
            status: "applied",
          },
        });
        await creditDefaultLocation(tx, sku, qtyOnHand);
      }

      return item;
    });

    return apiSuccess(result);
  } catch (err) {
    console.error("Failed to create product", err);
    return apiError("CREATE_FAILED", "Failed to create product. Please try again.", { status: 500 });
  }
}
