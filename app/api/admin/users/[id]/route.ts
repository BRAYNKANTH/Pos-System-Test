import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import bcrypt from "bcryptjs";

// PUT /api/admin/users/[id] — update user
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", "Admin access required", { status: 403 });
  }

  const { id } = await props.params;

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.name || !body.email) {
      return apiError("INVALID_INPUT", "Name and email are required.", { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: {
        email,
        id: { not: id }
      }
    });
    if (existing) {
      return apiError("EMAIL_EXISTS", "A user with this email address already exists.", { status: 400 });
    }

    const updateData: Prisma.UserUpdateInput = {
      name: body.name.trim(),
      email,
      role: body.role,
    };

    if (body.password) {
      updateData.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    });

    return apiSuccess(updated);
  } catch (err) {
    console.error("updateUser failed", err);
    return apiError("UPDATE_FAILED", "Failed to update user in database", { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — delete user
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", "Admin access required", { status: 403 });
  }

  const { id } = await props.params;

  if (currentUser.id === id) {
    return apiError("SELF_DELETE", "You cannot delete your own admin account.", { status: 400 });
  }

  try {
    await prisma.user.delete({
      where: { id }
    });
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("deleteUser failed", err);
    return apiError("DELETE_FAILED", "Failed to delete user from database", { status: 500 });
  }
}
