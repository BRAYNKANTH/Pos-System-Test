import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// lookupProduct — GET /api/pos/products?query= — search by barcode/SKU/
// name for the product menu. There's no separate product-catalog table in
// the build plan, so InventoryItem (sku, name, category, brand, unitPrice,
// qtyOnHand) doubles as the catalog — see the note on that model in
// schema.prisma. The POS screen fetches the full catalog once (no query)
// and filters client-side by search text + category/brand chips, so
// `take` here is a generous upper bound, not a page size.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const query = req.nextUrl.searchParams.get("query")?.trim() ?? "";
  const exact = req.nextUrl.searchParams.get("exact") === "1";
  const limit = Math.floor(Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 500)));
  const rawOffset = Number(req.nextUrl.searchParams.get("offset"));
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const brand = req.nextUrl.searchParams.get("brand") || undefined;

  const items = await prisma.inventoryItem.findMany({
    where: {
      category, brand,
      ...(query ? {
          OR: [
            { sku: exact ? { equals: query, mode: "insensitive" } : { contains: query, mode: "insensitive" } },
            { name: exact ? { equals: query, mode: "insensitive" } : { contains: query, mode: "insensitive" } },
          ],
        } : {}),
    },
    orderBy: [{ name: "asc" }, { sku: "asc" }],
    take: limit + 1,
    skip: offset,
  });

  return apiSuccess(
    items.slice(0, limit).map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      brand: item.brand,
      unitPrice: Number(item.unitPrice),
      purchasePrice: Number(item.purchasePrice) || 0,
      qtyOnHand: item.qtyOnHand,
      isScaleItem: item.isScaleItem,
      isReturnable: item.isReturnable,
      trackSerial: item.trackSerial,
      trackBatch: item.trackBatch,
      isNetPriceItem: item.isNetPriceItem,
    })),
    { meta: { hasMore: items.length > limit, limit, offset } },
  );
}
