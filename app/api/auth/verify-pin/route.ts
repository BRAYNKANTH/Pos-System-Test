import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { apiError, apiSuccess, errorMessage } from "@/lib/api-response";
import { verifyManagerPin } from "@/lib/auth/managerPin";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

    const body = await req.json().catch(() => null);
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

    if (!pin) {
      return apiError("INVALID_INPUT", "A manager PIN or card scan is required", { status: 400 });
    }

    const result = await verifyManagerPin(pin);
    if (!result.ok) {
      if (result.reason === "NO_PIN_CONFIGURED") {
        return apiError(
          "NO_PIN_CONFIGURED",
          "No manager or admin has a PIN or card set up yet — set one in Admin → Users before this can be used.",
          { status: 409 },
        );
      }
      return apiError("UNAUTHORIZED_PIN", "Invalid manager PIN or card", { status: 403 });
    }

    return apiSuccess({
      authorized: true,
      approverId: result.approverId,
      approverName: result.approverName,
      role: result.role,
      via: result.via,
    });
  } catch (err) {
    return apiError("INTERNAL_ERROR", errorMessage(err, "Failed to verify PIN"), { status: 500 });
  }
}
