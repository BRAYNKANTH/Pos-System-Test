import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// getLowStockAlerts — GET /api/inventory/low-stock — returns items below
// threshold. (PO-suggestion generation isn't in scope — flagged in
// docs/POS_Detailed_Build_Plan.md as a "returns ... PO suggestions" nice-
// to-have; this returns the qty gap, which is enough to act on.)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const items = await prisma.inventoryItem.findMany({
    orderBy: { qtyOnHand: "asc" },
  });
  const lowStock = items
    .filter((item) => item.qtyOnHand <= item.lowStockThreshold)
    .map((item) => ({
      sku: item.sku,
      name: item.name,
      qtyOnHand: item.qtyOnHand,
      lowStockThreshold: item.lowStockThreshold,
      suggestedReorderQty: Math.max(item.lowStockThreshold * 2 - item.qtyOnHand, 0),
    }));

  return apiSuccess(lowStock);
}
