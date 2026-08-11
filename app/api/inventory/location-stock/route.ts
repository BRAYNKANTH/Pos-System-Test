import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/inventory/location-stock?sku= — per-location breakdown for one
// sku (all locations, qty 0 included), used by the Stock Transfer form to
// show what's actually available at the chosen source location.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_TRANSFER))) {
    return apiError("FORBIDDEN", "Not allowed to view stock transfers", { status: 403 });
  }

  const sku = req.nextUrl.searchParams.get("sku")?.trim() ?? "";
  if (!sku) return apiError("INVALID_INPUT", "sku query param is required", { status: 400 });

  const [locations, stockRows] = await Promise.all([
    prisma.location.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.locationStock.findMany({ where: { sku } }),
  ]);

  const qtyByLocation = new Map(stockRows.map((r) => [r.locationId, r.qty]));
  const breakdown = locations.map((l) => ({
    locationId: l.id,
    locationName: l.name,
    qty: qtyByLocation.get(l.id) ?? 0,
  }));

  return apiSuccess(breakdown);
}
