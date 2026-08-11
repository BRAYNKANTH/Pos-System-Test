import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage printers", { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const connectionType = ["usb", "network", "bluetooth"].includes(body?.connectionType) ? body.connectionType : undefined;
  const paperWidthMm = body?.paperWidthMm !== undefined ? Number(body.paperWidthMm) : undefined;
  const ipAddress = typeof body?.ipAddress === "string" ? body.ipAddress.trim() || null : undefined;
  const isDefault = typeof body?.isDefault === "boolean" ? body.isDefault : undefined;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.printer.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.printer.update({
        where: { id },
        data: { name, connectionType, paperWidthMm, ipAddress, isDefault },
      });
    });
    return apiSuccess(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError("NOT_FOUND", "Printer not found", { status: 404 });
    }
    console.error("Failed to update printer", err);
    return apiError("UPDATE_FAILED", "Failed to update printer", { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage printers", { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.printer.delete({ where: { id } });
    return apiSuccess({ id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError("NOT_FOUND", "Printer not found", { status: 404 });
    }
    console.error("Failed to delete printer", err);
    return apiError("DELETE_FAILED", "Failed to delete printer", { status: 500 });
  }
}
