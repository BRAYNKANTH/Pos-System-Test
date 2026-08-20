import { prisma } from "@/lib/prisma";
import DiscountsClient, { type DBProduct } from "./DiscountsClient";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  const [items, discountItems] = await Promise.all([
    prisma.inventoryItem.findMany({
      select: {
        sku: true,
        name: true,
        category: true,
        brand: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.discount.findMany({
      orderBy: [
        { priority: "asc" },
        { name: "asc" },
      ],
    }),
  ]);

  const products = items.map((i) => ({
    sku: i.sku,
    name: i.name,
    category: i.category,
    brand: i.brand,
  }));

  const initialDiscounts = discountItems.map((d) => ({
    id: d.id,
    name: d.name,
    startsAt: d.startsAt.toISOString().slice(0, 16),
    endsAt: d.endsAt.toISOString().slice(0, 16),
    discountType: d.discountType,
    discountAmount: Number(d.discountAmount),
    priority: d.priority,
    brand: d.brand || "",
    category: d.category || "",
    products: d.products as unknown as DBProduct[],
    location: d.location,
    sellingPriceGroup: d.sellingPriceGroup,
    applyInCustomerGroups: d.applyInCustomerGroups,
    isActive: d.isActive,
  }));

  return <DiscountsClient products={products} initialDiscounts={initialDiscounts} />;
}
