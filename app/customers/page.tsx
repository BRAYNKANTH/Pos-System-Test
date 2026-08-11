import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AddCustomerForm } from "./_AddCustomerForm";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query } = await searchParams;
  const customers = await prisma.customer.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Customers</h1>

      <form className="flex gap-2">
        <input
          name="query"
          defaultValue={query}
          placeholder="Search by name or email…"
          className="h-9 flex-1 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
        />
      </form>

      <AddCustomerForm />

      <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {customers.length === 0 && <p className="p-4 text-sm text-zinc-400">No customers yet.</p>}
        {customers.map((c) => (
          <Link
            key={c.id}
            href={`/customers/${c.id}`}
            className="flex items-center justify-between gap-2 p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <span>{c.name}</span>
            <span className="text-xs text-zinc-400">{c.email ?? c.phone ?? "—"}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
