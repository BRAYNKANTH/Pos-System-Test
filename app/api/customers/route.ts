import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { enqueueSyncJob } from "@/lib/sync/enqueueSyncJob";

// createOrUpdateCustomer — POST /api/customers — create/update profile,
// syncs to Zoho contacts.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : undefined;
  const name = typeof body?.name === "string" ? body.name : "";
  const email = typeof body?.email === "string" && body.email ? body.email : undefined;
  const phone = typeof body?.phone === "string" && body.phone ? body.phone : undefined;
  const loyaltyMetadata = body?.loyaltyMetadata ?? undefined;

  if (!name) return apiError("INVALID_INPUT", "name is required", { status: 400 });

  try {
    const customer = id
      ? await prisma.customer.update({ where: { id }, data: { name, email, phone, loyaltyMetadata } })
      : await prisma.customer.create({ data: { name, email, phone, loyaltyMetadata } });

    await enqueueSyncJob({
      entityType: "customer",
      entityId: customer.id,
      payload: { name: customer.name, email: customer.email, phone: customer.phone },
    });

    return apiSuccess(customer);
  } catch (err) {
    console.error("createOrUpdateCustomer failed", err);
    return apiError("SAVE_FAILED", "Failed to save customer", { status: 500 });
  }
}

// Search/filter list — GET /api/customers?query=
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const query = req.nextUrl.searchParams.get("query")?.trim() ?? "";
  const customers = await prisma.customer.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 50,
  });
  return apiSuccess(customers);
}
