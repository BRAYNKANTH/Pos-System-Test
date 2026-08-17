import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/business-info — minimal, read-only branding info (shop name +
// default location) available to ANY authenticated user.
//
// Why this exists instead of reusing /api/admin/business-settings or
// /api/admin/locations: both of those are gated behind SETTINGS_MANAGE /
// LOCATION_VIEW, which cashiers don't have by default. Client components
// that just need "what's this shop called" (sidebar, POS header, printed
// receipts, product labels) were calling the gated endpoint anyway, and
// since the fetch was always wrapped in `.catch(() => {})`, a 403 for a
// cashier silently failed and the component kept showing its hardcoded
// fallback string forever — which is how a hardcoded "Mektas Supers"
// stayed on screen for non-admin users even after the real business name
// was changed in Settings. Basic branding info isn't sensitive; every
// staff member should be able to read it without a special permission.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const [settings, defaultLocation] = await Promise.all([
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    prisma.location.findFirst({ where: { isDefault: true } }),
  ]);

  const location = defaultLocation ?? (await prisma.location.findFirst());
  const data = (settings?.data as { bizName?: string } | null) ?? {};

  return apiSuccess({
    bizName: data.bizName ?? null,
    defaultLocation: location ? { id: location.id, name: location.name, code: location.code } : null,
  });
}
