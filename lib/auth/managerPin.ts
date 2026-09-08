import { prisma } from "@/lib/prisma";

export type ManagerPinResult =
  | { ok: true; approverId: string; approverName: string; role: "ADMIN" | "MANAGER" }
  | { ok: false; reason: "NO_PIN_CONFIGURED" | "INVALID_PIN" };

/** Verifies a manager/admin PIN against real users' configured `pinCode`
 * (set in Admin → Users). Shared by /api/auth/verify-pin (the standalone
 * "call a manager over" modal) and any action that needs the same
 * in-person authorization inline with its own request (e.g. overriding a
 * Final-Sale return) — the latter should call this directly rather than
 * trusting a client-supplied "I already got approved" flag from an
 * earlier, separate request, which could be fabricated or replayed.
 *
 * There is deliberately no universal fallback PIN. An earlier version of
 * this check accepted a hardcoded "1234" or "0000" whenever no manager
 * had a PIN configured yet — those are among the most commonly guessed
 * PINs anywhere, and it silently made every manager-gated action in the
 * app (price overrides, this) bypassable by anyone who tried the two
 * most obvious codes. If nobody has a PIN configured yet, that's a setup
 * gap to fix in Admin → Users, not a hole to paper over.
 */
export async function verifyManagerPin(pin: string): Promise<ManagerPinResult> {
  const authorizedUsers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] }, pinCode: { not: null } },
    select: { id: true, name: true, role: true, pinCode: true },
  });

  if (authorizedUsers.length === 0) {
    return { ok: false, reason: "NO_PIN_CONFIGURED" };
  }

  const match = authorizedUsers.find((u) => u.pinCode === pin);
  if (!match) return { ok: false, reason: "INVALID_PIN" };

  return {
    ok: true,
    approverId: match.id,
    approverName: match.name,
    role: match.role as "ADMIN" | "MANAGER",
  };
}
