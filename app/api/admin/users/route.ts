import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import bcrypt from "bcryptjs";
import { hashPinCode } from "@/lib/auth/pinHash";

// GET /api/admin/users — list users
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", "Admin access required", { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pinCode: true,
        cardCode: true,
      },
      orderBy: { name: "asc" }
    });
    // Never ship the raw pinCode/cardCode values to a list view — just
    // whether one's configured. The actual card code is only ever
    // returned once, right after issuing it (POST .../card), the same
    // moment it gets printed — not re-fetchable afterward from here.
    const sanitized = users.map(({ pinCode, cardCode, ...rest }) => ({
      ...rest,
      hasPinCode: pinCode !== null,
      hasCardCode: cardCode !== null,
    }));
    return apiSuccess(sanitized);
  } catch (err) {
    console.error("fetchUsers failed", err);
    return apiError("FETCH_FAILED", "Failed to retrieve users", { status: 500 });
  }
}

// POST /api/admin/users — create user
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", "Admin access required", { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.name || !body.email || !body.password) {
      return apiError("INVALID_INPUT", "Name, email, and password are required.", { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return apiError("EMAIL_EXISTS", "A user with this email address already exists.", { status: 400 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    // pinCode used to be collected by the form and silently dropped here
    // — never persisted on create, so the "Security PIN" field never
    // actually did anything for a brand-new user.
    const rawPinCode = typeof body.pinCode === "string" && body.pinCode.trim() ? body.pinCode.trim() : undefined;
    // Stored hashed (see lib/auth/pinHash.ts), never in plaintext — matches
    // how passwordHash is handled above.
    const pinCode = rawPinCode !== undefined ? hashPinCode(rawPinCode) : undefined;

    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        passwordHash,
        role: body.role || "CASHIER",
        pinCode,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    });

    return apiSuccess({ ...user, hasPinCode: pinCode !== undefined, hasCardCode: false });
  } catch (err) {
    console.error("createUser failed", err);
    return apiError("CREATE_FAILED", "Failed to save user to database", { status: 500 });
  }
}
