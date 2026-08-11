import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SHIPMENT_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to view shipments", { status: 403 });
  }

  const shipments = await prisma.shipment.findMany({
    include: { transaction: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return apiSuccess(shipments);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SHIPMENT_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to create shipments", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
  const carrier = typeof body?.carrier === "string" && body.carrier.trim() ? body.carrier.trim() : undefined;
  const trackingNumber =
    typeof body?.trackingNumber === "string" && body.trackingNumber.trim() ? body.trackingNumber.trim() : undefined;

  if (!transactionId) return apiError("INVALID_INPUT", "transactionId is required", { status: 400 });

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) return apiError("NOT_FOUND", "Transaction not found", { status: 404 });

  try {
    const shipment = await prisma.shipment.create({
      data: {
        transactionId,
        carrier,
        trackingNumber,
        status: "pending",
      },
    });
    return apiSuccess(shipment, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError("ALREADY_EXISTS", "This transaction already has a shipment record", { status: 409 });
    }
    console.error("Failed to create shipment", err);
    return apiError("CREATE_FAILED", "Failed to create shipment", { status: 500 });
  }
}
