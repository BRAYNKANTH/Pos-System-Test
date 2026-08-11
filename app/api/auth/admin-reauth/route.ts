import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, grantElevatedAccess } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// authenticateAdmin — PIN/password re-auth required before any bill
// mutation or approval. Grants a 5-minute "elevated" window — see
// lib/auth/session.ts.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return apiError("INVALID_INPUT", "Password is required", { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return apiError("INVALID_CREDENTIALS", "Incorrect password", { status: 401 });
  }

  await grantElevatedAccess(user.id);
  return apiSuccess({ elevated: true, expiresInSeconds: 300 });
}
