import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET /api/pos/tax-rate — returns the default tax rate used at checkout.
// Used by the POS page to display the actual rate instead of a hardcoded value.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const taxRule = await prisma.taxRule.findFirst({ where: { isDefault: true } });
  return apiSuccess({ rate: taxRule ? Number(taxRule.rate) : 0, name: taxRule?.name ?? "Tax" });
}
