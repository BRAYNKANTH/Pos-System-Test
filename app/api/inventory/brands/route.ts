import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// Mirrors app/api/inventory/categories/route.ts — see that file's header
// comment for why this exists (brand, like category, is a free-text
// InventoryItem field with no management screen until now).

// GET /api/inventory/brands — distinct brands with product counts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const rows = await prisma.inventoryItem.groupBy({
    by: ["brand"],
    where: { brand: { not: null } },
    _count: { _all: true },
    orderBy: { brand: "asc" },
  });

  const brands = rows
    .filter((r) => r.brand && r.brand.trim())
    .map((r) => ({ name: r.brand as string, productCount: r._count._all }));

  return apiSuccess(brands);
}

// PATCH /api/inventory/brands — rename a brand across every product that
// uses it.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to manage brands", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const from = typeof body?.from === "string" ? body.from.trim() : "";
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!from || !to) {
    return apiError("INVALID_INPUT", "from and to are required", { status: 400 });
  }
  if (from === to) return apiSuccess({ updated: 0 });

  const result = await prisma.inventoryItem.updateMany({
    where: { brand: from },
    data: { brand: to },
  });
  return apiSuccess({ updated: result.count });
}

// DELETE /api/inventory/brands?name=X — clear a brand off every product
// that uses it (products aren't deleted, just unbranded).
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to manage brands", { status: 403 });
  }

  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return apiError("INVALID_INPUT", "name is required", { status: 400 });

  const result = await prisma.inventoryItem.updateMany({
    where: { brand: name },
    data: { brand: null },
  });
  return apiSuccess({ updated: result.count });
}
