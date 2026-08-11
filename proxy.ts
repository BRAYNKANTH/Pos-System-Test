import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Coarse gate only — runs in the Edge runtime, so it can't hit the DB
// (Prisma needs Node). It just checks the session JWT is present and
// correctly signed. Authoritative checks (session actually still exists /
// hasn't been revoked, role/permission checks) happen in
// lib/auth/session.ts's getCurrentUser() inside each route handler / page,
// which does query the DB.
//
// Named `proxy.ts` per Next.js 16 — this file was called `middleware.ts`
// in older Next.js versions; the convention was renamed but works the same.

const SESSION_COOKIE = "pos_session";
const PUBLIC_PATHS = ["/login"];

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return unauthenticated(request);

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    return unauthenticated(request);
  }
}

function unauthenticated(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHENTICATED", message: "Login required" } },
      { status: 401 },
    );
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
