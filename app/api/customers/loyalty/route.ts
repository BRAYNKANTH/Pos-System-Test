import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiError, apiSuccess, errorMessage } from "@/lib/api-response";
import {
  calculateLoyaltyTier,
  pointsToDiscountValue,
  discountValueToPointsNeeded,
} from "@/lib/customers/loyalty";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return apiError("BAD_REQUEST", "customerId search parameter is required", { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        loyaltyTier: true,
      },
    });

    if (!customer) {
      return apiError("NOT_FOUND", "Customer not found", { status: 404 });
    }

    const currentTier = calculateLoyaltyTier(customer.loyaltyPoints);
    const maxDiscountValue = pointsToDiscountValue(customer.loyaltyPoints);

    // If tier has changed, update customer row asynchronously
    if (currentTier !== customer.loyaltyTier) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyTier: currentTier },
      });
    }

    return apiSuccess({
      customerId: customer.id,
      name: customer.name,
      loyaltyPoints: customer.loyaltyPoints,
      loyaltyTier: currentTier,
      maxDiscountValue,
    });
  } catch (err) {
    return apiError("INTERNAL_ERROR", errorMessage(err, "Failed to fetch loyalty data"), { status: 500 });
  }
}

// Manual points redemption — no longer used at checkout (redeeming
// against a sale now happens atomically inside /api/pos/checkout, which
// also correctly earns points on the sale; this route previously had no
// auth check, and was also being called by the old checkout flow with
// mismatched field names — `amountSpent` instead of `redeemPoints` /
// `redeemDiscount` — so it 400'd on every single sale and no points were
// ever actually earned). Kept for a possible future admin/manual-redeem
// use case.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

    const body = await req.json();
    const { customerId, redeemPoints, redeemDiscount } = body;

    if (!customerId) {
      return apiError("BAD_REQUEST", "customerId is required", { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return apiError("NOT_FOUND", "Customer not found", { status: 404 });
    }

    let pointsToDeduct = redeemPoints;
    if (!pointsToDeduct && redeemDiscount) {
      pointsToDeduct = discountValueToPointsNeeded(redeemDiscount);
    }

    if (!pointsToDeduct || pointsToDeduct <= 0) {
      return apiError("BAD_REQUEST", "Invalid points deduction amount", { status: 400 });
    }

    if (customer.loyaltyPoints < pointsToDeduct) {
      return apiError("BAD_REQUEST", "Customer does not have enough loyalty points", { status: 400 });
    }

    const discountAmount = pointsToDiscountValue(pointsToDeduct);
    const newPoints = customer.loyaltyPoints - pointsToDeduct;
    const newTier = calculateLoyaltyTier(newPoints);

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: newPoints,
        loyaltyTier: newTier,
      },
    });

    return apiSuccess({
      redeemedPoints: pointsToDeduct,
      discountAmount,
      remainingPoints: updatedCustomer.loyaltyPoints,
      loyaltyTier: updatedCustomer.loyaltyTier,
    });
  } catch (err) {
    return apiError("INTERNAL_ERROR", errorMessage(err, "Failed to redeem loyalty points"), { status: 500 });
  }
}
