import "server-only";
import { createHmac } from "crypto";

// Manager PINs and access-card codes are short-lived, low-entropy
// authorization credentials (see lib/auth/managerPin.ts) — unlike
// passwordHash they used to be stored as plain strings, so a database
// compromise (backup leak, unrelated future SQLi, DBA/support access)
// would hand out every manager's override code directly. bcrypt isn't a
// fit here: cardCode has a DB-level @unique constraint (one live code
// per physical card) and verifyManagerPin needs an exact-match lookup
// across both fields, and bcrypt's per-call random salt would make
// neither possible. HMAC-SHA256 keyed with SESSION_SECRET is
// deterministic (same code always hashes the same way, so @unique and
// direct WHERE-clause lookups still work) while remaining non-reversible
// without that server secret.
function getKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

export function hashPinCode(code: string): string {
  return createHmac("sha256", getKey()).update(code).digest("hex");
}
