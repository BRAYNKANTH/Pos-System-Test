export type ReturnPriceLine = { sku: string; qty: number; unitPrice: unknown; discount?: unknown; taxAmount?: unknown };

/** Consume prior returns first, then refund the next units at their original net price. */
export function priceReturn(lines: ReturnPriceLine[], alreadyReturned: number, qty: number) {
  if (!Number.isSafeInteger(alreadyReturned) || alreadyReturned < 0) throw new Error("Invalid previous return quantity");
  if (!Number.isSafeInteger(qty) || qty < 0) throw new Error("Return quantity must be a whole number");
  if (alreadyReturned + qty > lines.reduce((sum, l) => sum + l.qty, 0)) throw new Error("Return exceeds remaining quantity");
  let skip = alreadyReturned, remaining = qty, amount = 0;
  const allocations: { index: number; qty: number; offset: number }[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const offset = Math.min(skip, line.qty); skip -= offset;
    const take = Math.min(remaining, line.qty - offset);
    if (take > 0) {
      const net = Number(line.unitPrice) * line.qty - Number(line.discount ?? 0) + Number(line.taxAmount ?? 0);
      // Allocate cents cumulatively so several partial refunds equal the original net total.
      const centsThrough = (units: number) => Math.round((net * units / line.qty + Number.EPSILON) * 100);
      amount += (centsThrough(offset + take) - centsThrough(offset)) / 100;
      allocations.push({ index, qty: take, offset }); remaining -= take;
    }
  }
  return { amount: Math.round((amount + Number.EPSILON) * 100) / 100, allocations };
}
