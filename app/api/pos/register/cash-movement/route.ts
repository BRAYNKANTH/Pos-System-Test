import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { recordCashMovement, NoOpenRegisterError } from "@/lib/pos/register";

// POST /api/pos/register/cash-movement — record cash in/out during an
// open session (e.g. paying a delivery driver from the till, or topping
// up change float).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.REGISTER_OPEN))) {
    return apiError("FORBIDDEN", "Not allowed to record cash movements", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const type = body?.type === "out" ? "out" : body?.type === "in" ? "in" : "";
  const amount = Number(body?.amount);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!sessionId || !type || !Number.isFinite(amount) || amount <= 0 || !reason) {
    return apiError("INVALID_INPUT", "sessionId, type (in/out), a positive amount, and a reason are required", {
      status: 400,
    });
  }

  try {
    const movement = await recordCashMovement({ sessionId, type, amount, reason, createdById: user.id });
    return apiSuccess(movement, { status: 201 });
  } catch (err) {
    if (err instanceof NoOpenRegisterError) {
      return apiError("NOT_OPEN", err.message, { status: 409 });
    }
    console.error("Failed to record cash movement", err);
    return apiError("MOVEMENT_FAILED", "Failed to record cash movement", { status: 500 });
  }
}
