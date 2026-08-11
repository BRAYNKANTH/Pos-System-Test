import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// PATCH /api/admin/locations/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.LOCATION_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage locations", { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const city = typeof body?.city === "string" ? body.city.trim() || null : undefined;
  const country = typeof body?.country === "string" ? body.country.trim() || null : undefined;
  const landmark = typeof body?.landmark === "string" ? body.landmark.trim() || null : undefined;

  try {
    const location = await prisma.location.update({
      where: { id },
      data: { name, city, country, landmark },
    });
    return apiSuccess(location);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError("NOT_FOUND", "Location not found", { status: 404 });
    }
    console.error("Failed to update location", err);
    return apiError("UPDATE_FAILED", "Failed to update location", { status: 500 });
  }
}

// DELETE /api/admin/locations/:id — blocked for the default location and
// for any location still holding stock (its LocationStock rows would
// otherwise cascade-delete, silently discarding that breakdown).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.LOCATION_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage locations", { status: 403 });
  }

  const { id } = await params;
  const location = await prisma.location.findUnique({ where: { id } });
  if (!location) return apiError("NOT_FOUND", "Location not found", { status: 404 });
  if (location.isDefault) {
    return apiError("DEFAULT_LOCATION", "Can't delete the default location", { status: 409 });
  }

  const stockRemaining = await prisma.locationStock.aggregate({
    where: { locationId: id },
    _sum: { qty: true },
  });
  if ((stockRemaining._sum.qty ?? 0) > 0) {
    return apiError(
      "LOCATION_HAS_STOCK",
      "Transfer out all stock from this location before deleting it",
      { status: 409 },
    );
  }

  try {
    await prisma.location.delete({ where: { id } });
    return apiSuccess({ id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return apiError(
        "LOCATION_IN_USE",
        "This location has purchase or transfer history and can't be deleted",
        { status: 409 },
      );
    }
    console.error("Failed to delete location", err);
    return apiError("DELETE_FAILED", "Failed to delete location", { status: 500 });
  }
}
