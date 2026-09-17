import { prisma } from "@/lib/prisma";

export function reportRange(input: { from?: string; to?: string }, now = new Date()) {
  const localNow = new Date(now.getTime() + 330 * 60000);
  const to = input.to ?? localNow.toISOString().slice(0, 10);
  const from = input.from ?? new Date(localNow.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  if (![from, to].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d))) throw new Error("Choose valid report dates");
  if (![from, to].every(d => { const parsed = new Date(d); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d; })) throw new Error("Choose valid calendar dates");
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 93 * 86400000) throw new Error("Choose a date range of 1 to 93 days");
  return { from, to, createdAt: { gte: start, lt: end } };
}

/** Every report read is scoped, including sales lines and customer relations. */
export function reportDatabase(range: ReturnType<typeof reportRange>) {
  return prisma.$extends({ query: { $allModels: { async findMany({ model, args, query }) {
    const scope = ["Transaction", "Purchase", "StockAdjustment", "Expense", "StockTransfer", "SalesReturn"].includes(model)
      ? { createdAt: range.createdAt }
      : ["TransactionItem", "PaymentTender"].includes(model) ? { transaction: { createdAt: range.createdAt } } : null;
    const options = args as { where?: Record<string, unknown>; include?: Record<string, unknown> };
    if (scope) options.where = { AND: [options.where ?? {}, scope] };
    if (model === "Customer" && options.include?.transactions) options.include.transactions = { where: { createdAt: range.createdAt } };
    return query(args);
  } } } });
}
