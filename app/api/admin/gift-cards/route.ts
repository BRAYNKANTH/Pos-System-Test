import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiError, apiSuccess, errorMessage } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");

    const giftCards = await prisma.giftCard.findMany({
      where: query
        ? {
            OR: [
              { code: { contains: query, mode: "insensitive" } },
              { notes: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(giftCards);
  } catch (err) {
    return apiError("INTERNAL_ERROR", errorMessage(err, "Failed to fetch gift cards"), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

    const body = await req.json();
    const { amount, customCode, notes, expiresDays } = body;

    const initialBalance = Number(amount);
    if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
      return apiError("INVALID_INPUT", "Valid positive amount is required", { status: 400 });
    }

    // Generate unique random 12-char code if customCode not supplied
    let code = customCode ? String(customCode).trim().toUpperCase() : "";
    if (!code) {
      const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      const timestampStr = Date.now().toString(36).slice(-4).toUpperCase();
      code = `GC-${randStr}-${timestampStr}`;
    }

    const existing = await prisma.giftCard.findUnique({ where: { code } });
    if (existing) {
      return apiError("ALREADY_EXISTS", `Gift card code '${code}' already exists`, { status: 409 });
    }

    let expiresAt: Date | null = null;
    if (expiresDays && Number(expiresDays) > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(expiresDays));
    }

    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        initialBalance,
        currentBalance: initialBalance,
        status: "active",
        notes: notes ? String(notes).trim() : null,
        expiresAt,
      },
    });

    return apiSuccess(giftCard);
  } catch (err) {
    return apiError("INTERNAL_ERROR", errorMessage(err, "Failed to create gift card"), { status: 500 });
  }
}
