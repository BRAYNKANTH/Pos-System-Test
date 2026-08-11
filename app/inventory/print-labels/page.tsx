import { prisma } from "@/lib/prisma";
import PrintLabelsClient from "./PrintLabelsClient";

export const dynamic = "force-dynamic";

export default async function PrintLabelsPage() {
  const items = await prisma.inventoryItem.findMany({
    select: {
      sku: true,
      name: true,
      unitPrice: true,
      category: true,
      brand: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Map to matching schema types
  const products = items.map((i) => ({
    sku: i.sku,
    name: i.name,
    unitPrice: Number(i.unitPrice),
    category: i.category,
    brand: i.brand,
  }));

  return <PrintLabelsClient products={products} />;
}
