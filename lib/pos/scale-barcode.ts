/**
 * Variable Weight / Price Embedded Scale Barcode Parser
 *
 * Standard Retail Formats:
 * EAN-13 / UPC-A scale barcodes usually start with prefixes '02', '20', '04', '28', or '29'.
 *
 * Pattern 1: Embedded Price (Format: 02/20 + 4 or 5 digit PLU/SKU + 5-digit price in cents + checksum)
 * Pattern 2: Embedded Weight (Format: 02/20 + 4 or 5 digit PLU/SKU + 5-digit weight in grams + checksum)
 *
 * Example:
 * 0212345004508 -> Prefix '02', PLU '12345', Value 450 ($4.50 or 0.450 kg)
 */

export interface ParsedScaleBarcode {
  isScaleBarcode: boolean;
  prefix?: string;
  itemCode?: string; // 4 or 5 digit SKU / PLU
  rawValue?: number; // e.g. 450
  embeddedPrice?: number; // e.g. 4.50
  embeddedWeight?: number; // in kg, e.g. 0.450 or 1.250
  rawBarcode: string;
}

const SCALE_PREFIXES = ["02", "20", "04", "28", "29"];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseScaleBarcode(barcode: string): ParsedScaleBarcode {
  const clean = barcode.trim();

  // Must be 12 (UPC-A) or 13 (EAN-13) digits long and purely numeric
  if (!/^\d{12,13}$/.test(clean)) {
    return { isScaleBarcode: false, rawBarcode: clean };
  }

  // Normalize 12-digit to 13-digit by prepending 0 if needed
  const normalized = clean.length === 12 ? `0${clean}` : clean;
  const prefix = normalized.substring(0, 2);

  if (!SCALE_PREFIXES.includes(prefix)) {
    return { isScaleBarcode: false, rawBarcode: clean };
  }

  // Format with 5-digit item code and 5-digit value (common EAN-13 structure: 2-5-5-1)
  // e.g., 02 [item: 12345] [val: 00450] [check: 8]
  const itemCode5 = normalized.substring(2, 7);
  const valString5 = normalized.substring(7, 12);
  const rawValue = parseInt(valString5, 10);

  if (isNaN(rawValue)) {
    return { isScaleBarcode: false, rawBarcode: clean };
  }

  const embeddedPrice = Math.round(rawValue) / 100; // 00450 -> $4.50
  const embeddedWeight = Math.round(rawValue) / 1000; // 00450 -> 0.450 kg

  return {
    isScaleBarcode: true,
    prefix,
    itemCode: itemCode5,
    rawValue,
    embeddedPrice,
    embeddedWeight,
    rawBarcode: clean,
  };
}

/**
 * Resolves the actual amount to charge for a scanned (or manually
 * weighed) scale item.
 *
 * A scale line's cart quantity is always 1 (see cart-store's addItem —
 * scale items never merge into an existing line, since each weighing is
 * its own physical event) — `calculateCart` only ever does
 * `qty × unitPrice`, with no separate notion of weight. So the `unitPrice`
 * returned here IS the full resolved charge for the line, not a per-kg
 * rate: previously this returned the catalog per-kg rate unchanged and
 * left the actual multiplication by weight for the caller to do, which no
 * caller ever did — every weighed item was silently charged as if it
 * weighed exactly 1kg (or 1 of whatever the catalog unit is), regardless
 * of what the scale said.
 *
 * `scaleWeight` and `displayRatePerKg` are for the cart/receipt display
 * ("0.450 kg @ Rs 200.00/kg") only — they play no further part in the
 * money math once `unitPrice` is set.
 */
export function resolveScaleItemPricing(params: {
  unitPrice: number; // catalog price per kg (weight-based) or list price
  isWeightBased?: boolean; // true when the catalog price is a per-kg rate
  parsed: ParsedScaleBarcode;
}): {
  unitPrice: number;
  scaleWeight?: number;
  displayRatePerKg?: number;
} {
  const { unitPrice, isWeightBased, parsed } = params;

  if (isWeightBased && parsed.embeddedWeight) {
    const weight = parsed.embeddedWeight;
    return {
      unitPrice: round2(weight * unitPrice),
      scaleWeight: weight,
      displayRatePerKg: unitPrice,
    };
  }

  if (parsed.embeddedPrice && unitPrice > 0) {
    // Price is already embedded in the barcode (e.g. a deli-counter scale
    // that prints its own price label) — that IS the amount to charge;
    // weight is back-calculated purely for display.
    const price = parsed.embeddedPrice;
    const calculatedWeight = Math.round((price / unitPrice) * 1000) / 1000;
    return {
      unitPrice: price,
      scaleWeight: calculatedWeight,
      displayRatePerKg: unitPrice,
    };
  }

  return { unitPrice };
}

/** Same resolution, for a manually-typed weight (no barcode scan) — e.g.
 * clicking a scale item's catalog card when there's no scanner/scale
 * attached, or the printed barcode is damaged. */
export function resolveManualWeightPricing(params: {
  unitPrice: number; // catalog price per kg
  weightKg: number;
}): { unitPrice: number; scaleWeight: number; displayRatePerKg: number } {
  const { unitPrice, weightKg } = params;
  return {
    unitPrice: round2(weightKg * unitPrice),
    scaleWeight: weightKg,
    displayRatePerKg: unitPrice,
  };
}
