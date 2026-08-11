import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return apiError("INVALID_INPUT", "Email and password are required", { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return apiError("INVALID_CREDENTIALS", "Invalid email or password", { status: 401 });
  }

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });

  return apiSuccess({ id: user.id, name: user.name, email: user.email, role: user.role });
}
