/**
 * Shown instantly by Next.js the moment a sidebar link is clicked, while
 * the destination page's server-side data (session check, permission
 * check, DB queries) is still in flight.
 *
 * Why this matters here: every route in this app is force-dynamic (auth
 * reads cookies() on every page), and dynamic routes without a loading.tsx
 * boundary are not prefetched at all — Next.js just blocks the click with
 * zero visual feedback until the whole server round-trip resolves. On a
 * page with a couple of un-parallelized DB round trips (session lookup +
 * permission check + the page's own queries), that's easily 1-3+ seconds
 * with nothing on screen changing, which reads as "the app didn't
 * register my click" and invites a second (or third) click. Adding this
 * boundary fixes both problems: it gives Next.js somewhere to stream into
 * immediately (sidebar highlight + URL update happen right away), and it
 * makes the destination shell prefetchable in the first place.
 */
export function PageLoadingSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading page">
      <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-10 w-full max-w-md rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="h-10 bg-zinc-100 dark:bg-zinc-900" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-t border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-950"
          />
        ))}
      </div>
    </div>
  );
}
