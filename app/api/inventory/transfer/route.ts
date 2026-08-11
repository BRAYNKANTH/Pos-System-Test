import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { transferStock, InsufficientLocationStockError } from "@/lib/inventory/locationStock";

// GET /api/inventory/transfer — recent transfer history, newest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_TRANSFER))) {
    return apiError("FORBIDDEN", "Not allowed to view stock transfers", { status: 403 });
  }

  const transfers = await prisma.stockTransfer.findMany({
    include: { fromLocation: true, toLocation: true, requester: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return apiSuccess(transfers);
}

// POST /api/inventory/transfer — move stock between two locations. See
// lib/inventory/locationStock.ts for the race-safe implementation; this
// never touches InventoryItem.qtyOnHand (the system-wide total is
// unchanged by an internal transfer, only its location breakdown moves).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_TRANSFER))) {
    return apiError("FORBIDDEN", "Not allowed to transfer stock", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const sku = typeof body?.sku === "string" ? body.sku : "";
  const qty = Number(body?.qty);
  const fromLocationId = typeof body?.fromLocationId === "string" ? body.fromLocationId : "";
  const toLocationId = typeof body?.toLocationId === "string" ? body.toLocationId : "";
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : undefined;

  if (!sku || !Number.isFinite(qty) || qty <= 0 || !fromLocationId || !toLocationId) {
    return apiError("INVALID_INPUT", "sku, a positive qty, fromLocationId and toLocationId are required", {
      status: 400,
    });
  }
  if (fromLocationId === toLocationId) {
    return apiError("SAME_LOCATION", "Source and destination locations must be different", { status: 400 });
  }

  try {
    const transfer = await transferStock({
      sku,
      qty,
      fromLocationId,
      toLocationId,
      requestedBy: user.id,
      note,
    });
    return apiSuccess(transfer, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientLocationStockError) {
      return apiError("INSUFFICIENT_STOCK", err.message, { status: 409 });
    }
    console.error("transferStock failed", err);
    return apiError("TRANSFER_FAILED", "Failed to transfer stock", { status: 500 });
  }
}
