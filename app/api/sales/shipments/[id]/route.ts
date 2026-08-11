import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

const VALID_STATUSES = ["pending", "shipped", "delivered"];

// PATCH /api/sales/shipments/:id — update status/tracking (e.g. mark
// shipped once handed to the carrier, delivered once confirmed).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SHIPMENT_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage shipments", { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = VALID_STATUSES.includes(body?.status) ? body.status : undefined;
  const carrier = typeof body?.carrier === "string" ? body.carrier.trim() || null : undefined;
  const trackingNumber = typeof body?.trackingNumber === "string" ? body.trackingNumber.trim() || null : undefined;

  try {
    const updated = await prisma.shipment.update({
      where: { id },
      data: {
        status,
        carrier,
        trackingNumber,
        shippedAt: status === "shipped" ? new Date() : undefined,
        deliveredAt: status === "delivered" ? new Date() : undefined,
      },
    });
    return apiSuccess(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError("NOT_FOUND", "Shipment not found", { status: 404 });
    }
    console.error("Failed to update shipment", err);
    return apiError("UPDATE_FAILED", "Failed to update shipment", { status: 500 });
  }
}
