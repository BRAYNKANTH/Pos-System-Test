import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { closeRegisterSession, NoOpenRegisterError } from "@/lib/pos/register";

// POST /api/pos/register/close — count the drawer, close the session,
// record the variance against what was expected.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.REGISTER_CLOSE))) {
    return apiError("FORBIDDEN", "Not allowed to close the register", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const closingCount = Number(body?.closingCount);
  const notes = typeof body?.notes === "string" ? body.notes : undefined;

  if (!sessionId || !Number.isFinite(closingCount) || closingCount < 0) {
    return apiError("INVALID_INPUT", "sessionId and a non-negative closingCount are required", { status: 400 });
  }

  try {
    const session = await closeRegisterSession({ sessionId, closedById: user.id, closingCount, notes });
    return apiSuccess(session);
  } catch (err) {
    if (err instanceof NoOpenRegisterError) {
      return apiError("NOT_OPEN", err.message, { status: 409 });
    }
    console.error("Failed to close register", err);
    return apiError("CLOSE_FAILED", "Failed to close register", { status: 500 });
  }
}
