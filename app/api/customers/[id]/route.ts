import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// getCustomerHistory — GET /api/customers/:id — purchase history lookup.
// Returns both `orders` (status tracking) and `transactions` (itemized
// sales, since checkout now records an optional customerId per sale).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" } },
      transactions: { orderBy: { createdAt: "desc" }, include: { items: true } },
    },
  });
  if (!customer) return apiError("NOT_FOUND", "Customer not found", { status: 404 });

  return apiSuccess(customer);
}
