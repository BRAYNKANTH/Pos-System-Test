import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateTax } from "@/lib/pos/pricing";
import { deductStockOnSale, InsufficientStockError } from "@/lib/inventory/stock";
import { errorMessage } from "@/lib/errors";

// Bulk historical-sales import — the real implementation behind what was
// previously a "Coming Soon" placeholder at /sales/import. One CSV row is
// one line item; rows sharing the same non-blank `reference` column are
// grouped into a single transaction (so a multi-item historical sale can
// be represented as several rows). Rows with no reference are each their
// own one-line transaction.
//
// Capped at MAX_ROWS per request — this runs inside one DB transaction
// with a generous but finite timeout (see IMPORT_TRANSACTION_OPTIONS
// below); a very large backlog should be split into multiple CSV uploads
// rather than pushing that limit out indefinitely.
const MAX_ROWS = 1000;
const IMPORT_TRANSACTION_OPTIONS = { timeout: 60000, maxWait: 15000 };

type ImportRow = {
  date: string;
  reference: string;
  sku: string;
  qty: number;
  unitPrice: number | null;
  discount: number;
  paymentMethod: string;
  customerEmail: string | null;
};

type RowError = { rowIndex: number; message: string };

const VALID_PAYMENT_METHODS = new Set(["cash", "card", "wallet", "gift_card"]);

function parseRows(raw: unknown): { rows: ImportRow[]; errors: RowError[] } {
  const errors: RowError[] = [];
  if (!Array.isArray(raw)) return { rows: [], errors: [{ rowIndex: -1, message: "rows must be an array" }] };

  const rows: ImportRow[] = raw.map((r, idx) => {
    const rowIndex = idx + 1; // 1-based, matches the CSV preview shown to the user
    const dateStr = typeof r?.date === "string" ? r.date.trim() : "";
    const parsedDate = dateStr ? new Date(dateStr) : null;
    if (!dateStr || !parsedDate || isNaN(parsedDate.getTime())) {
      errors.push({ rowIndex, message: `Invalid or missing date: "${r?.date ?? ""}"` });
    }

    const sku = typeof r?.sku === "string" ? r.sku.trim() : "";
    if (!sku) errors.push({ rowIndex, message: "Missing sku" });

    const qty = Number(r?.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push({ rowIndex, message: `Invalid qty: "${r?.qty ?? ""}" (must be a positive number)` });
    }

    const unitPriceRaw = r?.unitPrice;
    const unitPrice =
      unitPriceRaw === undefined || unitPriceRaw === null || unitPriceRaw === ""
        ? null
        : Number(unitPriceRaw);
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      errors.push({ rowIndex, message: `Invalid unitPrice: "${unitPriceRaw}"` });
    }

    const discountRaw = r?.discount;
    const discount = discountRaw === undefined || discountRaw === null || discountRaw === "" ? 0 : Number(discountRaw);
    if (!Number.isFinite(discount) || discount < 0) {
      errors.push({ rowIndex, message: `Invalid discount: "${discountRaw}"` });
    }

    const paymentMethod = (typeof r?.paymentMethod === "string" && r.paymentMethod.trim().toLowerCase()) || "cash";
    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
      errors.push({ rowIndex, message: `Unknown paymentMethod: "${paymentMethod}" (use cash, card, wallet, or gift_card)` });
    }

    const customerEmail = typeof r?.customerEmail === "string" && r.customerEmail.trim() ? r.customerEmail.trim().toLowerCase() : null;
    const reference = typeof r?.reference === "string" ? r.reference.trim() : "";

    return {
      date: dateStr,
      reference,
      sku,
      qty: Number.isFinite(qty) ? qty : 0,
      unitPrice,
      discount: Number.isFinite(discount) ? discount : 0,
      paymentMethod,
      customerEmail,
    };
  });

  return { rows, errors };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  // Bulk-writing historical financial records is an administrative data
  // operation, not a normal cashier action — gated the same as other
  // admin-only settings/data tools.
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to import sales data", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const deductStock = body?.deductStock === true;

  if (!Array.isArray(body?.rows) || body.rows.length === 0) {
    return apiError("INVALID_INPUT", "rows[] is required and must be non-empty", { status: 400 });
  }
  if (body.rows.length > MAX_ROWS) {
    return apiError(
      "TOO_MANY_ROWS",
      `This import has ${body.rows.length} rows — the limit per upload is ${MAX_ROWS}. Split it into multiple files.`,
      { status: 400 },
    );
  }

  const { rows, errors: parseErrors } = parseRows(body.rows);
  if (parseErrors.length > 0) {
    return apiError("VALIDATION_FAILED", `${parseErrors.length} row(s) failed validation`, {
      status: 400,
      details: { errors: parseErrors },
    });
  }

  // Group rows into transactions by reference — rows with no reference
  // are each their own transaction (group key includes the row index so
  // they never collide with each other).
  const groups = new Map<string, ImportRow[]>();
  rows.forEach((row, idx) => {
    const key = row.reference || `__row_${idx}`;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  });

  const skus = [...new Set(rows.map((r) => r.sku))];
  const emails = [...new Set(rows.map((r) => r.customerEmail).filter((e): e is string => !!e))];

  const [inventoryItems, customers, taxRule] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { sku: { in: skus } } }),
    emails.length > 0 ? prisma.customer.findMany({ where: { email: { in: emails } } }) : Promise.resolve([]),
    prisma.taxRule.findFirst({ where: { isDefault: true } }),
  ]);
  const bySku = new Map(inventoryItems.map((i) => [i.sku, i]));
  const byEmail = new Map(customers.map((c) => [c.email, c]));
  const taxRate = taxRule ? Number(taxRule.rate) : 0;

  const missingSkus = skus.filter((s) => !bySku.has(s));
  if (missingSkus.length > 0) {
    return apiError("UNKNOWN_SKU", `Unknown SKU(s): ${missingSkus.join(", ")}`, { status: 400 });
  }
  const missingCustomers = emails.filter((e) => !byEmail.has(e));
  if (missingCustomers.length > 0) {
    return apiError(
      "UNKNOWN_CUSTOMER",
      `No existing customer with email(s): ${missingCustomers.join(", ")} — leave customerEmail blank to import as a walk-in sale.`,
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      for (const [key, groupRows] of groups) {
        let subtotal = 0;
        let totalDiscount = 0;
        let tax = 0;
        const lineData = groupRows.map((row) => {
          const item = bySku.get(row.sku)!;
          const unitPrice = row.unitPrice ?? Number(item.unitPrice);
          const discount = Math.min(row.discount, row.qty * unitPrice);
          const lineSubtotal = row.qty * unitPrice - discount;
          const taxAmount = calculateTax(lineSubtotal, taxRate);
          subtotal += row.qty * unitPrice;
          totalDiscount += discount;
          tax += taxAmount;
          return { sku: row.sku, qty: row.qty, unitPrice, discount, taxAmount };
        });
        const total = Math.round((subtotal - totalDiscount + tax) * 100) / 100;

        const first = groupRows[0];
        const customer = first.customerEmail ? byEmail.get(first.customerEmail) : undefined;

        if (deductStock) {
          for (const line of lineData) {
            await deductStockOnSale(tx, line.sku, line.qty);
          }
        }

        await tx.transaction.create({
          data: {
            registerId: "csv-import",
            cashierId: user.id,
            customerId: customer?.id ?? null,
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total,
            paymentMethod: first.paymentMethod,
            // Deterministic from the CSV's own `reference` column (not
            // randomized) so re-uploading the same file hits Transaction's
            // unique idempotencyKey constraint instead of silently
            // duplicating every row — see the P2002 handling below. Rows
            // with no reference key off their position in this specific
            // upload, so re-upload protection only really holds when the
            // file's row order is unchanged.
            idempotencyKey: `import-${key}`,
            createdAt: new Date(first.date),
            items: { createMany: { data: lineData.map((l) => ({ sku: l.sku, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, taxAmount: l.taxAmount })) } },
            tenders: { createMany: { data: [{ method: first.paymentMethod, amount: total }] } },
          },
        });
        created++;
      }
      return { created };
    }, IMPORT_TRANSACTION_OPTIONS);

    return apiSuccess({ transactionsCreated: result.created, rowsImported: rows.length });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return apiError("INSUFFICIENT_STOCK", `Not enough current stock for ${err.sku} to deduct — uncheck "deduct from stock" or fix the quantity first.`, { status: 409 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError(
        "ALREADY_IMPORTED",
        "One or more rows in this file (by their reference column) were already imported previously. Nothing was saved — remove the already-imported rows/references and re-upload.",
        { status: 409 },
      );
    }
    console.error("sales import failed", err);
    return apiError("IMPORT_FAILED", errorMessage(err, "Import failed. Nothing was saved."), { status: 500 });
  }
}
