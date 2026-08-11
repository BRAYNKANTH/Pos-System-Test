import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// "List Drafts" — draft-type held carts (see HeldCart in schema.prisma).
// Resuming a draft happens from the POS screen's Held panel, which needs
// the cart-store client context — this page is a read-only list; click
// through to /pos and use "Held" there to actually resume one.
export default async function DraftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const drafts = await prisma.heldCart.findMany({
    where: { cashierId: user.id, type: "draft" },
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  return (
    <main className="flex-1 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Drafts</h1>
        <Link
          href="/pos"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Add Draft
        </Link>
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Drafts are parked at the POS screen. Open <Link href="/pos" className="text-blue-600 hover:underline dark:text-blue-400">/pos</Link> and click <strong>Held</strong> to resume one.
      </p>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-xs font-bold uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2.5">Created</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Items</th>
              <th className="px-4 py-2.5">Note</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {drafts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                  No drafts yet.
                </td>
              </tr>
            )}
            {drafts.map((d) => {
              const lines = Array.isArray(d.lines) ? (d.lines as { qty: number }[]) : [];
              return (
                <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-2.5 text-zinc-500">{d.createdAt.toLocaleString()}</td>
                  <td className="px-4 py-2.5">{d.customer?.name ?? "Walk-In Customer"}</td>
                  <td className="px-4 py-2.5">{lines.length} item(s)</td>
                  <td className="px-4 py-2.5 text-zinc-500">{d.note ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge>draft</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
