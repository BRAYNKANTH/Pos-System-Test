import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// Categories aren't a separate table — InventoryItem.category is a free
// text field, set ad-hoc via a prompt() on Add Product with no management
// screen at all (the sidebar link was disabled, "coming soon"). This is
// that screen: list the distinct values actually in use, with product
// counts, and real rename/clear actions that update every product using
// that value in one go — rather than leaving typo'd or duplicate
// categories (e.g. "Snacks" vs "snacks") permanently stuck once used.

// GET /api/inventory/categories — distinct categories with product counts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const rows = await prisma.inventoryItem.groupBy({
    by: ["category"],
    where: { category: { not: null } },
    _count: { _all: true },
    orderBy: { category: "asc" },
  });

  const categories = rows
    .filter((r) => r.category && r.category.trim())
    .map((r) => ({ name: r.category as string, productCount: r._count._all }));

  return apiSuccess(categories);
}

// PATCH /api/inventory/categories — rename a category across every
// product that uses it.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to manage categories", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const from = typeof body?.from === "string" ? body.from.trim() : "";
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!from || !to) {
    return apiError("INVALID_INPUT", "from and to are required", { status: 400 });
  }
  if (from === to) return apiSuccess({ updated: 0 });

  const result = await prisma.inventoryItem.updateMany({
    where: { category: from },
    data: { category: to },
  });
  return apiSuccess({ updated: result.count });
}

// DELETE /api/inventory/categories?name=X — clear a category off every
// product that uses it (products aren't deleted, just uncategorized).
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to manage categories", { status: 403 });
  }

  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return apiError("INVALID_INPUT", "name is required", { status: 400 });

  const result = await prisma.inventoryItem.updateMany({
    where: { category: name },
    data: { category: null },
  });
  return apiSuccess({ updated: result.count });
}
