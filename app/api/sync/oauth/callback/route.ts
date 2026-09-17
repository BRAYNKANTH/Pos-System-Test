import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { exchangeCodeForToken, isDataCenter, parseOAuthState, OAUTH_STATE_COOKIE } from "@/lib/sync/zohoClient";
import { isModuleEnabled } from "@/lib/plan";

function noncesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// OAuth 2.0 callback — Zoho redirects here with ?code=...&state=... after
// the admin authorizes access. `state` carries back both the data center
// /api/sync/oauth/connect sent (see buildAuthorizeUrl) — so the code
// exchange hits the same data center's token endpoint the auth request
// went to — and the anti-CSRF nonce that route stashed in a cookie,
// which must match before any code gets exchanged. Without that check,
// anyone could complete their own Zoho consent and hand the resulting
// `code` to a logged-in admin (e.g. via a link to this URL), silently
// repointing the store's Zoho connection at the attacker's own org.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  if (!isModuleEnabled("zoho")) {
    return NextResponse.redirect(new URL("/", appUrl));
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/admin/settings/integrations?error=missing_code", appUrl));
  }

  const stateParam = req.nextUrl.searchParams.get("state") ?? "com";
  const { dataCenter: dataCenterRaw, nonce } = parseOAuthState(stateParam);
  const dataCenter = isDataCenter(dataCenterRaw) ? dataCenterRaw : "com";

  const expectedNonce = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const stateValid = !!nonce && !!expectedNonce && noncesMatch(nonce, expectedNonce);

  if (!stateValid) {
    const res = NextResponse.redirect(new URL("/admin/settings/integrations?error=invalid_state", appUrl));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }

  try {
    await exchangeCodeForToken(code, dataCenter);
    const res = NextResponse.redirect(new URL("/admin/settings/integrations?connected=1", appUrl));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("Zoho OAuth callback failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    const res = NextResponse.redirect(
      new URL(`/admin/settings/integrations?error=exchange_failed&detail=${encodeURIComponent(message)}`, appUrl),
    );
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }
}
