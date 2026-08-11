import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getOpenRegisterSession, openRegisterSession, RegisterAlreadyOpenError } from "@/lib/pos/register";

// GET /api/pos/register — the currently open session, if any (or null).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.REGISTER_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view register status", { status: 403 });
  }

  const session = await getOpenRegisterSession();
  return apiSuccess(session);
}

// POST /api/pos/register — open a new session with a starting float.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.REGISTER_OPEN))) {
    return apiError("FORBIDDEN", "Not allowed to open the register", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const openingFloat = Number(body?.openingFloat);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return apiError("INVALID_INPUT", "openingFloat must be a non-negative number", { status: 400 });
  }

  try {
    const session = await openRegisterSession(user.id, openingFloat);
    return apiSuccess(session, { status: 201 });
  } catch (err) {
    if (err instanceof RegisterAlreadyOpenError) {
      return apiError("ALREADY_OPEN", err.message, { status: 409 });
    }
    console.error("Failed to open register", err);
    return apiError("OPEN_FAILED", "Failed to open register", { status: 500 });
  }
}
