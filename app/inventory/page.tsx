import { prisma } from "@/lib/prisma";
import InventoryListClient from "./_components/InventoryListClient";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch all products sorted by name
  const items = await prisma.inventoryItem.findMany({
    orderBy: { name: "asc" },
  });

  const formattedItems = items.map((item) => ({
    ...item,
    unitPrice: Number(item.unitPrice),
    purchasePrice: Number(item.purchasePrice),
  }));

  // Extract unique categories and brands for the filter boxes
  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
  const brands = Array.from(new Set(items.map((i) => i.brand).filter(Boolean)));

  return (
    <InventoryListClient
      initialItems={formattedItems}
      categories={categories}
      brands={brands}
    />
  );
}
