import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { buildAuthorizeUrl, isDataCenter } from "@/lib/sync/zohoClient";

// connectZohoOAuth — GET /api/sync/oauth/connect?dc=com — starts the
// OAuth 2.0 flow by redirecting to Zoho's authorize URL for the chosen
// data center (defaults to "com" — the account picker on
// /admin/settings/integrations lets an admin pick a different one if
// their Zoho org lives elsewhere, e.g. "in").
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin));
  if (!(await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES))) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Admin only" } },
      { status: 403 },
    );
  }

  const dcParam = req.nextUrl.searchParams.get("dc") ?? "com";
  const dataCenter = isDataCenter(dcParam) ? dcParam : "com";

  try {
    const url = buildAuthorizeUrl(dataCenter);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "ZOHO_NOT_CONFIGURED", message: (err as Error).message } },
      { status: 400 },
    );
  }
}
