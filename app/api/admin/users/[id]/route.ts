import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import bcrypt from "bcryptjs";
import { hashPinCode } from "@/lib/auth/pinHash";

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
    // pinCode used to be collected by the form and silently dropped here
    // — the "Security PIN" field never actually saved anything, so
    // verifyManagerPin (lib/auth/managerPin.ts) had no real PIN to ever
    // match against. The client only ever sends this key when the field
    // has a value typed into it (an empty field is omitted, not sent as
    // ""), so this only ever sets a new PIN — it can't accidentally wipe
    // an existing one just because the field was left blank on an edit.
    if (typeof body.pinCode === "string" && body.pinCode.trim()) {
      // Stored hashed (see lib/auth/pinHash.ts), never in plaintext.
      updateData.pinCode = hashPinCode(body.pinCode.trim());
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pinCode: true,
        cardCode: true,
      }
    });

    // Same sanitization as GET /api/admin/users — never ship the raw
    // secret back out, just whether one's set (see that route's note).
    const { pinCode, cardCode, ...rest } = updated;
    return apiSuccess({ ...rest, hasPinCode: pinCode !== null, hasCardCode: cardCode !== null });
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
