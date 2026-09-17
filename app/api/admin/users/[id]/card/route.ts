import type { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hashPinCode } from "@/lib/auth/pinHash";

// Generates a random numeric card code — same alphabet as a typed PIN
// (digits only), just longer, so it scans through the exact same input
// field a PIN goes into (see ManagerPinModal) without needing to tell
// the two apart client-side. 12 digits keeps collisions astronomically
// unlikely for any realistic staff count while still encoding cleanly
// as a CODE128 barcode.
function generateCardCode(): string {
  let code = "";
  for (let i = 0; i < 12; i++) code += crypto.randomInt(0, 10);
  return code;
}

// POST /api/admin/users/[id]/card — issue (or reissue) a manager access
// card. Reissuing invalidates whatever code was printed on the old
// physical card — there's only ever one live code per user.
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", "Admin access required", { status: 403 });
  }

  const { id } = await props.params;
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return apiError("NOT_FOUND", "User not found", { status: 404 });
  if (target.role !== "ADMIN" && target.role !== "MANAGER") {
    return apiError(
      "INVALID_ROLE",
      "Only Admin or Manager accounts can be issued an override card — verifyManagerPin only ever authorizes those two roles",
      { status: 400 },
    );
  }

  // Collisions are practically impossible at 12 digits, but retry a
  // couple of times against the unique constraint rather than trusting
  // that in a hot loop — cheap insurance for a one-time admin action.
  for (let attempt = 0; attempt < 5; attempt++) {
    const cardCode = generateCardCode();
    try {
      // Stored hashed (see lib/auth/pinHash.ts) — same deterministic
      // hash every time this exact code is hashed, so the @unique
      // constraint on cardCode still catches a genuine collision. The
      // plaintext code is only ever returned here, in this one response,
      // for the admin to print — never persisted or re-fetchable.
      const updated = await prisma.user.update({
        where: { id },
        data: { cardCode: hashPinCode(cardCode) },
        select: { id: true, name: true },
      });
      return apiSuccess({ ...updated, cardCode }, { status: 201 });
    } catch (err) {
      const isUniqueClash =
        err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueClash || attempt === 4) {
        console.error("issueManagerCard failed", err);
        return apiError("ISSUE_FAILED", "Failed to issue card", { status: 500 });
      }
    }
  }
  return apiError("ISSUE_FAILED", "Failed to issue card", { status: 500 });
}

// DELETE /api/admin/users/[id]/card — revoke a manager's access card
// (e.g. lost, stolen, or the person left) without touching their PIN or
// anything else about the account.
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", "Admin access required", { status: 403 });
  }

  const { id } = await props.params;
  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { cardCode: null },
      select: { id: true, name: true, cardCode: true },
    });
    return apiSuccess(updated);
  } catch (err) {
    console.error("revokeManagerCard failed", err);
    return apiError("REVOKE_FAILED", "Failed to revoke card", { status: 500 });
  }
}
