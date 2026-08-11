import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/suppliers?query= — list/search suppliers, used by both the
// Suppliers page and the supplier picker on Add Purchase.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SUPPLIER_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view suppliers", { status: 403 });
  }

  const query = req.nextUrl.searchParams.get("query")?.trim() ?? "";
  const suppliers = await prisma.supplier.findMany({
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
  });
  return apiSuccess(suppliers);
}

// POST /api/suppliers — create a supplier.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SUPPLIER_CREATE))) {
    return apiError("FORBIDDEN", "Not allowed to create suppliers", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : undefined;
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : undefined;
  const address = typeof body?.address === "string" && body.address.trim() ? body.address.trim() : undefined;

  if (!name) return apiError("INVALID_INPUT", "name is required", { status: 400 });

  try {
    const supplier = await prisma.supplier.create({ data: { name, email, phone, address } });
    return apiSuccess(supplier, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError("DUPLICATE_EMAIL", "A supplier with that email already exists", { status: 409 });
    }
    console.error("Failed to create supplier", err);
    return apiError("CREATE_FAILED", "Failed to create supplier", { status: 500 });
  }
}
