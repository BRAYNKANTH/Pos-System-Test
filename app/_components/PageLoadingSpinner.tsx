/**
 * Shown by Next.js the instant a link to a dynamic page is clicked, while
 * that page's unavoidable database round trip is still in flight (see
 * lib/auth/session.ts and lib/auth/rbac.ts for why some of that wait is
 * real, physical network latency to the DB and not fixable in app code).
 *
 * Deliberately NOT a fake skeleton of the destination page's layout — an
 * earlier version mimicked a generic table/list shape on every route,
 * which looked like the wrong page flashing on screen for pages shaped
 * differently (the dashboard's stat-card grid, settings forms, etc).
 * This is content-agnostic on purpose: same honest "something is
 * loading" signal everywhere, no shape to mismatch.
 *
 * Presence of this file is also what lets Next.js prefetch these dynamic
 * routes at all (a route with zero Suspense/loading boundary isn't
 * prefetched in this Next version) — so hovering a sidebar link before
 * clicking can shave real time off the wait, not just cover it up.
 */
export function PageLoadingSpinner() {
  return (
    <div
      className="flex flex-1 items-center justify-center py-24"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-950 dark:border-t-indigo-400" />
    </div>
  );
}
