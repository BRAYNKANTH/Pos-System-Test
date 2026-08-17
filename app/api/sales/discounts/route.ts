import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/sales/discounts — Fetch all discounts
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  try {
    const discounts = await prisma.discount.findMany({
      orderBy: [
        { priority: "asc" },
        { name: "asc" }
      ]
    });
    return apiSuccess(discounts);
  } catch (err) {
    console.error("fetchDiscounts failed", err);
    return apiError("FETCH_FAILED", "Failed to load discounts from database", { status: 500 });
  }
}

// POST /api/sales/discounts — Create a discount
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.name || !body.discountAmount) {
      return apiError("INVALID_INPUT", "Name and discount amount are required.", { status: 400 });
    }

    let location: string = body.location || "";
    if (!location) {
      const defaultLocation = await prisma.location.findFirst({ where: { isDefault: true } });
      location = defaultLocation?.name ?? (await prisma.location.findFirst())?.name ?? "";
    }

    const discount = await prisma.discount.create({
      data: {
        name: body.name,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        discountType: body.discountType,
        discountAmount: Number(body.discountAmount),
        priority: Number(body.priority) || 1,
        brand: body.brand || null,
        category: body.category || null,
        products: body.products || [], // JSON array
        location,
        sellingPriceGroup: body.sellingPriceGroup || "All",
        applyInCustomerGroups: !!body.applyInCustomerGroups,
        isActive: body.isActive !== false,
      }
    });

    return apiSuccess(discount);
  } catch (err) {
    console.error("createDiscount failed", err);
    return apiError("CREATE_FAILED", "Failed to save discount to database", { status: 500 });
  }
}
