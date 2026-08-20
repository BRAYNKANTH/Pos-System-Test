/**
 * Deployment-level feature modules — for when this POS is packaged out to
 * different clients, some of whom bought the Zoho Books integration
 * add-on and some of whom didn't. Each client gets their own deployment
 * (own env vars, own database), so this is a build-time flag baked into
 * that client's env, not a per-user or per-org runtime toggle stored in
 * the database — the standard "edition/plan" pattern for a
 * one-deployment-per-customer product, as opposed to a shared multi-
 * tenant SaaS where the same running instance serves many orgs at once.
 *
 * `NEXT_PUBLIC_` is required for MODULE_ZOHO specifically because it
 * gates client-component UI (the sidebar link, settings pages) as well
 * as server logic — Next.js inlines `NEXT_PUBLIC_*` vars into the client
 * bundle at build time, which is exactly what's needed here (baked in
 * per-deployment, not a runtime secret). This is a feature flag, not
 * sensitive data, so that's a safe use of a public env var.
 *
 * Adding a new module later: add one line here, then gate whatever
 * UI/logic needs it with `isModuleEnabled("newModule")` — see the Zoho
 * gates in app/_components/AppSidebar.tsx, lib/sync/enqueueSyncJob.ts,
 * app/admin/settings/integrations/page.tsx, and app/admin/sync-status/
 * page.tsx for the pattern to copy.
 */
export const MODULES = {
  zoho: process.env.NEXT_PUBLIC_MODULE_ZOHO === "true",
} as const;

export type ModuleKey = keyof typeof MODULES;

export function isModuleEnabled(key: ModuleKey): boolean {
  return MODULES[key];
}
