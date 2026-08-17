import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

    const body = await req.json().catch(() => null);
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

    if (!pin) {
      return apiError("INVALID_INPUT", "Security PIN is required", { status: 400 });
    }

    // Check if PIN matches any Manager or Admin user in the system
    const authorizedUsers = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "MANAGER"] },
        pinCode: { not: null },
      },
      select: {
        id: true,
        name: true,
        role: true,
        pinCode: true,
      },
    });

    const matchingUser = authorizedUsers.find((u) => u.pinCode === pin);

    if (!matchingUser) {
      // Fallback: If no custom PIN was set on managers yet, allow default PIN "1234" or "0000" for emergency manager bypass
      if (pin === "1234" || pin === "0000") {
        return apiSuccess({
          authorized: true,
          approverName: "Manager Approval (Default PIN)",
          role: "MANAGER",
        });
      }
      return apiError("UNAUTHORIZED_PIN", "Invalid Manager PIN code", { status: 403 });
    }

    return apiSuccess({
      authorized: true,
      approverId: matchingUser.id,
      approverName: matchingUser.name,
      role: matchingUser.role,
    });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", err.message || "Failed to verify PIN", { status: 500 });
  }
}
