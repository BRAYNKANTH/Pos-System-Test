import type { Prisma } from "@prisma/client";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

/** Credits (adds to) a location's stock row for a sku, creating the row
 * if it doesn't exist yet. Used by goods receipt / purchases (stock
 * enters at a location) and as the destination side of a transfer. Does
 * NOT touch `InventoryItem.qtyOnHand` — callers that increase the
 * system-wide total (receiving new stock) must do that separately. */
export async function creditLocationStock(
  tx: Prisma.TransactionClient,
  locationId: string,
  sku: string,
  qty: number,
) {
  await tx.locationStock.upsert({
    where: { locationId_sku: { locationId, sku } },
    update: { qty: { increment: qty } },
    create: { locationId, sku, qty },
  });
}

/** Looks up the one location seeded as `isDefault`. Every stock-mutating
 * path that isn't location-aware (checkout, manual adjustments, the
 * standalone "Receive Stock"/"Add Product" actions) attributes its change
 * here, so LocationStock's totals stay a meaningful breakdown instead of
 * silently drifting away from InventoryItem.qtyOnHand as soon as a sale
 * happens somewhere other than through Add Purchase. */
async function getDefaultLocationId(tx: Prisma.TransactionClient): Promise<string | null> {
  const loc = await tx.location.findFirst({ where: { isDefault: true } });
  return loc?.id ?? null;
}

/** Credits the default location for a location-agnostic stock increase
 * (goods receipt, opening stock on a new product, a positive manual
 * adjustment). No-op if no default location is configured yet. */
export async function creditDefaultLocation(tx: Prisma.TransactionClient, sku: string, qty: number) {
  const locationId = await getDefaultLocationId(tx);
  if (!locationId) return;
  await creditLocationStock(tx, locationId, sku, qty);
}

/** Debits the default location for a location-agnostic stock decrease
 * (a POS sale, a negative manual adjustment). Deliberately best-effort —
 * unlike `transferStock`'s debit, this never blocks or fails the caller:
 * qtyOnHand is the authoritative total and the caller has already updated
 * it, so a missing/short LocationStock row (e.g. stock that entered
 * before locations existed) just clamps to 0 instead of going negative or
 * throwing and rolling back a real sale over bookkeeping. */
export async function debitDefaultLocationBestEffort(tx: Prisma.TransactionClient, sku: string, qty: number) {
  const locationId = await getDefaultLocationId(tx);
  if (!locationId) return;
  const row = await tx.locationStock.findUnique({ where: { locationId_sku: { locationId, sku } } });
  const next = Math.max(0, (row?.qty ?? 0) - qty);
  await tx.locationStock.upsert({
    where: { locationId_sku: { locationId, sku } },
    update: { qty: next },
    create: { locationId, sku, qty: next },
  });
}

export class InsufficientLocationStockError extends Error {
  constructor(public sku: string, public locationId: string) {
    super(`Insufficient stock for ${sku} at this location`);
  }
}

/** Race-safe debit of a location's stock row — conditional `updateMany`
 * like `deductStockOnSale`, so two concurrent transfers out of the same
 * location can't both succeed past what's actually there. */
async function debitLocationStock(
  tx: Prisma.TransactionClient,
  locationId: string,
  sku: string,
  qty: number,
) {
  const result = await tx.locationStock.updateMany({
    where: { locationId, sku, qty: { gte: qty } },
    data: { qty: { decrement: qty } },
  });
  if (result.count === 0) {
    throw new InsufficientLocationStockError(sku, locationId);
  }
}

/** Moves `qty` of `sku` from one location to another and records a
 * `StockTransfer` row. Net zero on `InventoryItem.qtyOnHand` — an
 * internal transfer doesn't create or destroy stock, only relocates it,
 * so the system-wide total is left untouched. */
export async function transferStock(params: {
  sku: string;
  qty: number;
  fromLocationId: string;
  toLocationId: string;
  requestedBy: string;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    await debitLocationStock(tx, params.fromLocationId, params.sku, params.qty);
    await creditLocationStock(tx, params.toLocationId, params.sku, params.qty);

    return tx.stockTransfer.create({
      data: {
        sku: params.sku,
        qty: params.qty,
        fromLocationId: params.fromLocationId,
        toLocationId: params.toLocationId,
        requestedBy: params.requestedBy,
        note: params.note ?? null,
      },
    });
  }, TRANSACTION_OPTIONS);
}
