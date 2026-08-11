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

  const items = await prisma.inventoryItem.findMany({
    where: query
      ? {
          OR: [
            { sku: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 500,
  });

  return apiSuccess(
    items.map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      brand: item.brand,
      unitPrice: Number(item.unitPrice),
      qtyOnHand: item.qtyOnHand,
    })),
  );
}
