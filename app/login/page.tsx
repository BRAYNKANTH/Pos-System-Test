import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LoginClient } from "./LoginClient";

const FALLBACK_BIZ_NAME = "Cloud POS System";

// Every unauthenticated visit to /login was paying a live Supabase round
// trip just to read the shop name — the same "every navigation pays full
// DB latency" problem already diagnosed and fixed for session/role-permission
// lookups (see lib/auth/session.ts's getCachedSession and
// lib/auth/rbac.ts's getAllRolePermissionsCached), just never applied here.
// /login is hit far more than most authenticated pages (every logout
// round-trips through it), so the uncached query was a real, frequently-felt
// slowdown, not a rare one. Business name changes maybe a few times a year,
// so a 5-minute cache is the same trade-off those two make; busted
// immediately on save via revalidateTag in PATCH /api/admin/business-settings
// so a rename doesn't sit stale for up to 5 minutes.
const getCachedBizName = unstable_cache(
  async () => {
    const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } }).catch(() => null);
    const data = (settings?.data as { bizName?: string } | null) ?? null;
    return data?.bizName?.trim() || null;
  },
  ["login-biz-name"],
  { tags: ["business-settings"], revalidate: 300 },
);

// Server Component — reads the shop name directly via Prisma instead of
// through /api/business-info, which requires a logged-in session (see
// that route's own docs). The login page is by definition the one place a
// visitor is never authenticated yet, so a client-side fetch of that
// endpoint would 401 every time and the "cool branding" would never show
// anything but the generic fallback. A bare shop name isn't sensitive
// data, so reading it here needs no auth check.
export default async function LoginPage() {
  const bizName = (await getCachedBizName()) || FALLBACK_BIZ_NAME;

  return <LoginClient bizName={bizName} />;
}
