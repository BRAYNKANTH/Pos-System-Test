import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiError, apiSuccess, errorMessage } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

    const { code } = await params;
    const searchCode = code.trim().toUpperCase();

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: searchCode },
    });

    if (!giftCard) {
      return apiError("NOT_FOUND", `Gift card code '${searchCode}' not found`, { status: 404 });
    }

    // Check expiration
    if (giftCard.expiresAt && new Date() > new Date(giftCard.expiresAt)) {
      if (giftCard.status !== "expired") {
        await prisma.giftCard.update({
          where: { id: giftCard.id },
          data: { status: "expired" },
        });
      }
      return apiError("EXPIRED", "This gift card has expired", { status: 400 });
    }

    if (giftCard.status === "deactivated") {
      return apiError("DEACTIVATED", "This gift card has been deactivated", { status: 400 });
    }

    if (giftCard.status === "redeemed" || Number(giftCard.currentBalance) <= 0) {
      return apiError("DEPLETED", "This gift card has zero remaining balance", { status: 400 });
    }

    return apiSuccess({
      id: giftCard.id,
      code: giftCard.code,
      initialBalance: Number(giftCard.initialBalance),
      currentBalance: Number(giftCard.currentBalance),
      status: giftCard.status,
      expiresAt: giftCard.expiresAt,
    });
  } catch (err) {
    return apiError("INTERNAL_ERROR", errorMessage(err, "Failed to lookup gift card"), { status: 500 });
  }
}

// Manual balance-adjustment endpoint — no longer used by POS checkout
// (redemption now happens atomically inside /api/pos/checkout itself, see
// that route's giftCardTenders handling) but kept for admin correction
// use. Previously had no auth check at all: anyone who knew or guessed a
// code could drain it to zero with a single unauthenticated request and
// no audit trail.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

    const { code } = await params;
    const body = await req.json();
    const { deductAmount } = body;

    const searchCode = code.trim().toUpperCase();
    const giftCard = await prisma.giftCard.findUnique({ where: { code: searchCode } });

    if (!giftCard) {
      return apiError("NOT_FOUND", "Gift card not found", { status: 404 });
    }

    const currentBal = Number(giftCard.currentBalance);
    const deduct = Number(deductAmount);

    if (!Number.isFinite(deduct) || deduct <= 0) {
      return apiError("INVALID_INPUT", "Valid deduction amount required", { status: 400 });
    }

    if (currentBal < deduct) {
      return apiError("INSUFFICIENT_BALANCE", `Gift card balance (Rs ${currentBal.toFixed(2)}) is less than requested Rs ${deduct.toFixed(2)}`, { status: 400 });
    }

    const newBalance = currentBal - deduct;
    const newStatus = newBalance === 0 ? "redeemed" : "active";

    const updated = await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        currentBalance: newBalance,
        status: newStatus,
      },
    });

    return apiSuccess({
      code: updated.code,
      deducted: deduct,
      remainingBalance: Number(updated.currentBalance),
      status: updated.status,
    });
  } catch (err) {
    return apiError("INTERNAL_ERROR", errorMessage(err, "Failed to update gift card"), { status: 500 });
  }
}
