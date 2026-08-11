import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// PATCH /api/suppliers/:id — update contact details.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SUPPLIER_UPDATE))) {
    return apiError("FORBIDDEN", "Not allowed to update suppliers", { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const email = typeof body?.email === "string" ? body.email.trim() || null : undefined;
  const phone = typeof body?.phone === "string" ? body.phone.trim() || null : undefined;
  const address = typeof body?.address === "string" ? body.address.trim() || null : undefined;

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name, email, phone, address },
    });
    return apiSuccess(supplier);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return apiError("NOT_FOUND", "Supplier not found", { status: 404 });
      }
      if (err.code === "P2002") {
        return apiError("DUPLICATE_EMAIL", "A supplier with that email already exists", { status: 409 });
      }
    }
    console.error("Failed to update supplier", err);
    return apiError("UPDATE_FAILED", "Failed to update supplier", { status: 500 });
  }
}

// DELETE /api/suppliers/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SUPPLIER_DELETE))) {
    return apiError("FORBIDDEN", "Not allowed to delete suppliers", { status: 403 });
  }

  const { id } = await params;
  const purchaseCount = await prisma.purchase.count({ where: { supplierId: id } });
  if (purchaseCount > 0) {
    return apiError(
      "SUPPLIER_HAS_PURCHASES",
      "Can't delete a supplier with existing purchase records",
      { status: 409 },
    );
  }

  try {
    await prisma.supplier.delete({ where: { id } });
    return apiSuccess({ id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError("NOT_FOUND", "Supplier not found", { status: 404 });
    }
    console.error("Failed to delete supplier", err);
    return apiError("DELETE_FAILED", "Failed to delete supplier", { status: 500 });
  }
}
