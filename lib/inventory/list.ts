import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function listInventory(params: URLSearchParams) {
  const query = params.get("query")?.trim() ?? "";
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.get("limit")) || 25)));
  const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
  const category = params.get("category"), brand = params.get("brand"), location = params.get("location");
  const where: Prisma.InventoryItemWhereInput = {
    ...(query ? { OR: [{ sku: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] } : {}),
    ...(category && category !== "All" ? { category } : {}),
    ...(brand && brand !== "All" ? { brand } : {}),
    ...(params.get("unit") === "KG" ? { isScaleItem: true } : params.get("unit") === "Pieces" ? { isScaleItem: false } : {}),
    ...(location && location !== "All" ? { locationStock: { some: { location: { name: location }, qty: { gt: 0 } } } } : {}),
    ...(params.get("low") === "1" ? { qtyOnHand: { lte: prisma.inventoryItem.fields.lowStockThreshold } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({ where, orderBy: [{ name: "asc" }, { sku: "asc" }], take: limit, skip: page * limit }),
    prisma.inventoryItem.count({ where }),
  ]);
  return { items: items.map(i => ({ ...i, unitPrice: Number(i.unitPrice), purchasePrice: Number(i.purchasePrice) })), total, page, limit };
}
