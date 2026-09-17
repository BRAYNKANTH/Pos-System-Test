export function ReportDateRange({ from, to }: { from: string; to: string }) {
  return <form method="get" className="mx-6 mt-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
    <label className="text-sm">From<input className="ml-2 rounded border p-2" type="date" name="from" defaultValue={from} required /></label>
    <label className="text-sm">Through<input className="ml-2 rounded border p-2" type="date" name="to" defaultValue={to} required /></label>
    <button className="rounded bg-indigo-700 px-4 py-2 text-white" type="submit">Apply dates</button>
    <p className="w-full text-sm text-zinc-600 dark:text-zinc-300">Activity is shown for these dates (Sri Lanka time). Stock balances are current. Maximum range: 93 days.</p>
  </form>;
}
