import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { errorMessage } from "@/lib/errors";

// A syntactically-valid bcrypt hash with no real corresponding password —
// compared against when the email doesn't exist, purely to burn the same
// amount of time bcrypt.compare would otherwise take. Without this,
// `!user || ...` short-circuits and skips bcrypt entirely for an unknown
// email, so a nonexistent-email response comes back measurably faster
// than a wrong-password one — an attacker probing many addresses can use
// that timing gap alone to enumerate which emails have real accounts.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8V.tXOAt9GbaFmmuqE8O6ZzUq/S8Wu";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return apiError("INVALID_INPUT", "Email and password are required", { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      return apiError("INVALID_CREDENTIALS", "Invalid email or password", { status: 401 });
    }

    await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });

    return apiSuccess({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    // Logged in full server-side; the client only ever gets a generic
    // message — this is the one endpoint reachable while logged out, so
    // it must never echo back raw DB/internal error text (could leak
    // schema/connection details to an unauthenticated caller).
    console.error("Login API route error:", errorMessage(err, "unknown error"));
    return apiError("DATABASE_ERROR", "Failed to process login request. Please try again.", { status: 500 });
  }
}
