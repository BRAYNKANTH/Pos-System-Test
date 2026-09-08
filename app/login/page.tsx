import { prisma } from "@/lib/prisma";
import { LoginClient } from "./LoginClient";

const FALLBACK_BIZ_NAME = "Cloud POS System";

// Server Component — reads the shop name directly via Prisma instead of
// through /api/business-info, which requires a logged-in session (see
// that route's own docs). The login page is by definition the one place a
// visitor is never authenticated yet, so a client-side fetch of that
// endpoint would 401 every time and the "cool branding" would never show
// anything but the generic fallback. A bare shop name isn't sensitive
// data, so reading it here needs no auth check.
export default async function LoginPage() {
  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  const data = (settings?.data as { bizName?: string } | null) ?? null;
  const bizName = data?.bizName?.trim() || FALLBACK_BIZ_NAME;

  return <LoginClient bizName={bizName} />;
}
