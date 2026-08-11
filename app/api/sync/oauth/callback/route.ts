import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { exchangeCodeForToken, isDataCenter } from "@/lib/sync/zohoClient";

// OAuth 2.0 callback — Zoho redirects here with ?code=...&state=... after
// the admin authorizes access. `state` carries back the data center
// /api/sync/oauth/connect sent (see buildAuthorizeUrl) so the code
// exchange hits the same data center's token endpoint the auth request
// went to — required for accounts outside the "com" data center.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/admin/settings/integrations?error=missing_code", appUrl));
  }

  const stateParam = req.nextUrl.searchParams.get("state") ?? "com";
  const dataCenter = isDataCenter(stateParam) ? stateParam : "com";

  try {
    await exchangeCodeForToken(code, dataCenter);
    return NextResponse.redirect(new URL("/admin/settings/integrations?connected=1", appUrl));
  } catch (err) {
    console.error("Zoho OAuth callback failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.redirect(
      new URL(`/admin/settings/integrations?error=exchange_failed&detail=${encodeURIComponent(message)}`, appUrl),
    );
  }
}
