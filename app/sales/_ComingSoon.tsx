export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex-1 p-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">{description}</p>
      <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
        Not built yet — flagged in the Sell menu to match the reference layout, but no backing
        feature behind it yet.
      </div>
    </main>
  );
}
