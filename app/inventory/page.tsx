import { prisma } from "@/lib/prisma";
import { listInventory } from "@/lib/inventory/list";
import InventoryListClient from "./_components/InventoryListClient";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function InventoryPage() {
  if (!(await getCurrentUser())) redirect('/login');
  const [result, categories, brands] = await Promise.all([
    listInventory(new URLSearchParams()),
    prisma.inventoryItem.groupBy({ by: ['category'], where: { category: { not: null } } }),
    prisma.inventoryItem.groupBy({ by: ['brand'], where: { brand: { not: null } } }),
  ]);
  return <InventoryListClient initialItems={result.items} initialTotal={result.total} categories={categories.map(c => c.category)} brands={brands.map(b => b.brand)} />;
}
