import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "pos_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Separate, short-lived cookie for the PIN/password re-auth required
// before any bill mutation or approval (`authenticateAdmin`).
const ELEVATED_COOKIE = "pos_elevated";
const ELEVATED_DURATION_MS = 1000 * 60 * 5; // 5 minutes

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function createSession(user: SessionUser) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt },
  });

  const token = await new SignJWT({ sub: user.id, sid: session.id, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (typeof payload.sid === "string") {
        await prisma.session.delete({ where: { id: payload.sid } }).catch(() => {});
      }
    } catch {
      // invalid/expired token — nothing to clean up server-side
    }
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ELEVATED_COOKIE);
}

/** The actual DB round trip behind session validation, cached across
 * requests (not just within one) for 30 seconds. This is what made
 * literally every navigation in the app pay a full Supabase round trip
 * before anything else could even start: the JWT verify itself is a fast
 * local crypto check, but confirming the session row hasn't been
 * revoked meant hitting the DB fresh on every single page load. A 30s
 * cache means only the first navigation in any given 30s window pays
 * that cost — everything after is an in-memory read. Trade-off: forcibly
 * revoking a session (deleting its row) can take up to 30s to actually
 * lock the user out, instead of being instant. That's the standard,
 * widely-used trade-off for JWT+revocation-check systems, and there's no
 * "force logout this device" admin feature here today that would need
 * tighter than that. Keyed by session id, not by cookie value, since
 * `unstable_cache` can't read cookies() itself — the token is verified
 * (outside this cache) before the id is ever passed in. */
const getCachedSession = unstable_cache(
  async (sessionId: string) => {
    return prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
  },
  ["session-by-id"],
  { revalidate: 30 },
);

/** Authoritative current-user lookup — verifies the JWT AND that the
 * session row still exists/hasn't expired (so revoking a session by
 * deleting its row takes effect within the cache window above, not
 * instantly but not forever-stale either).
 *
 * Wrapped in React's `cache()`: this is called by the root layout's
 * `Header` AND independently by nearly every page/route handler that
 * needs the current user — without caching, that's a fresh Supabase
 * round-trip per call, several times per single page load. `cache()`
 * memoizes per request, so repeat calls within the same render/request
 * are free. (Doesn't cache *across* requests on its own — that's what
 * `getCachedSession` above is for.) */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sid !== "string") return null;

    const session = await getCachedSession(payload.sid);
    if (!session || session.expiresAt < new Date()) return null;

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    };
  } catch {
    return null;
  }
});

/** Grants a short-lived "elevated" window after a successful password
 * re-check (see app/api/auth/admin-reauth). Approval endpoints require
 * this in addition to the normal permission check. */
export async function grantElevatedAccess(userId: string) {
  const expiresAt = new Date(Date.now() + ELEVATED_DURATION_MS);
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(ELEVATED_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function hasElevatedAccess(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ELEVATED_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sub === userId;
  } catch {
    return false;
  }
}
