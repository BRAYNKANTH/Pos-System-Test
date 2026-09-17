import { prisma } from "@/lib/prisma";
import { hashPinCode } from "@/lib/auth/pinHash";

export type ManagerPinResult =
  | { ok: true; approverId: string; approverName: string; role: "ADMIN" | "MANAGER"; via: "pin" | "card" }
  | { ok: false; reason: "NO_PIN_CONFIGURED" | "INVALID_PIN" };

/** Verifies a manager/admin credential — either a typed `pinCode` or a
 * scanned `cardCode` (a manager's physical access card, barcode-scanned
 * at the POS; both are just strings arriving in the same field, see
 * ManagerPinModal) — against real users' configured values (set in
 * Admin → Users). Shared by /api/auth/verify-pin (the standalone "call a
 * manager over" modal) and any action that needs the same in-person
 * authorization inline with its own request (e.g. overriding a
 * Final-Sale return, or a cashier-side price override) — the latter
 * should call this directly rather than trusting a client-supplied "I
 * already got approved" flag from an earlier, separate request, which
 * could be fabricated or replayed.
 *
 * There is deliberately no universal fallback PIN or card. An earlier
 * version of this check accepted a hardcoded "1234" or "0000" whenever
 * no manager had a PIN configured yet — those are among the most
 * commonly guessed PINs anywhere, and it silently made every
 * manager-gated action in the app (price overrides, this) bypassable by
 * anyone who tried the two most obvious codes. If nobody has a PIN or
 * card configured yet, that's a setup gap to fix in Admin → Users, not a
 * hole to paper over.
 */
export async function verifyManagerPin(code: string): Promise<ManagerPinResult> {
  const anyConfigured = await prisma.user.findFirst({
    where: {
      role: { in: ["ADMIN", "MANAGER"] },
      OR: [{ pinCode: { not: null } }, { cardCode: { not: null } }],
    },
    select: { id: true },
  });

  if (!anyConfigured) {
    return { ok: false, reason: "NO_PIN_CONFIGURED" };
  }

  // pinCode/cardCode are stored as HMAC hashes (see hashPinCode), so this
  // is a direct equality lookup — the same shape a plaintext WHERE would
  // have been, just against the hashed value instead.
  const hashed = hashPinCode(code);
  const match = await prisma.user.findFirst({
    where: {
      role: { in: ["ADMIN", "MANAGER"] },
      OR: [{ pinCode: hashed }, { cardCode: hashed }],
    },
    select: { id: true, name: true, role: true, cardCode: true },
  });
  if (!match) return { ok: false, reason: "INVALID_PIN" };

  return {
    ok: true,
    approverId: match.id,
    approverName: match.name,
    role: match.role as "ADMIN" | "MANAGER",
    via: match.cardCode === hashed ? "card" : "pin",
  };
}
