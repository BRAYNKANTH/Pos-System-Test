import Link from "next/link";

const modules = [
  { href: "/pos", label: "Checkout / Sales", owner: "Person 1" },
  { href: "/bills", label: "Bill Change Workflow", owner: "Person 2" },
  { href: "/inventory", label: "Inventory & Approval", owner: "Person 3" },
  { href: "/customers", label: "Customers", owner: "Person 5" },
  { href: "/reports", label: "Reports", owner: "Person 5" },
  { href: "/admin", label: "Admin Settings", owner: "Person 5" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Cloud POS System
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Base scaffold — each module below is owned by a different teammate.
          See <code className="font-mono">docs/task-allocation-plan.md</code>.
        </p>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {modules.map((m) => (
          <li key={m.href}>
            <Link
              href={m.href}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="font-medium">{m.label}</span>
              <span className="text-zinc-400">{m.owner}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
