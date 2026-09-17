import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export class InvalidSerialError extends Error {
  constructor(public serialNumber: string, public reason: string) {
    super(`Invalid serial number ${serialNumber}: ${reason}`);
  }
}

/**
 * Registers newly-received serial numbers as available for sale — called
 * from goods receipt when a delivery of serialized units arrives (see
 * lib/inventory/stock.ts's increaseStockOnReceipt). This is the only
 * legitimate way a serial enters the system; sale-time validation below
 * rejects anything that isn't registered here first.
 */
export async function registerSerials(
  tx: Prisma.TransactionClient,
  sku: string,
  serialNumbers: string[],
) {
  for (const raw of serialNumbers) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const existing = await tx.itemSerial.findUnique({
      where: { sku_serialNumber: { sku, serialNumber: trimmed } },
    });
    if (existing) {
      throw new InvalidSerialError(trimmed, "already registered — each serial number must be unique per SKU");
    }

    await tx.itemSerial.create({
      data: { sku, serialNumber: trimmed, status: "available" },
    });
  }
}

/**
 * Validates that provided serial numbers are real, pre-registered
 * (via registerSerials at goods receipt), and currently available — then
 * marks them sold against this transaction.
 *
 * An earlier version of this auto-registered any serial number typed at
 * the point of sale that didn't already exist, marking it "sold" on the
 * spot. That defeated the entire purpose of serial tracking: a cashier
 * (or anyone else) could type any string as a "serial" and it would be
 * silently accepted as a real, trackable unit — no different from not
 * tracking serials at all, except it *looked* like an audit trail existed.
 */
export async function validateAndAssignSerials(
  tx: Prisma.TransactionClient,
  sku: string,
  serialNumbers: string[],
  transactionId: string,
) {
  if (!serialNumbers || serialNumbers.length === 0) return;

  for (const sn of serialNumbers) {
    const trimmed = sn.trim();
    if (!trimmed) throw new InvalidSerialError(sn, "blank serial number");

    const record = await tx.itemSerial.findUnique({
      where: { sku_serialNumber: { sku, serialNumber: trimmed } },
    });

    if (!record) {
      throw new InvalidSerialError(trimmed, "not a registered serial for this product — register it at goods receipt first");
    }
    if (record.status !== "available") {
      throw new InvalidSerialError(trimmed, `serial is currently marked as '${record.status}'`);
    }

    const assigned = await tx.itemSerial.updateMany({
      where: { id: record.id, status: "available" },
      data: { status: "sold", transactionId },
    });
    if (assigned.count !== 1) throw new InvalidSerialError(trimmed, "serial was sold by another checkout; select another unit");
  }
}

/**
 * Release / return serial number back to available
 */
export async function returnSerial(
  tx: Prisma.TransactionClient,
  sku: string,
  serialNumber: string,
) {
  const trimmed = serialNumber.trim();
  if (!trimmed) return;

  const record = await tx.itemSerial.findUnique({
    where: { sku_serialNumber: { sku, serialNumber: trimmed } },
  });

  if (record) {
    await tx.itemSerial.update({
      where: { id: record.id },
      data: { status: "available", transactionId: null },
    });
  }
}
