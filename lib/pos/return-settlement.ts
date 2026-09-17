type ReturnSettlement = {
  isExchange: boolean;
  refundAmount: unknown;
  refundMethod: string;
  netAmount: unknown;
  netPaymentMethod: string | null;
};

/** Positive means collected from the customer; negative means paid out. */
export function returnSettlement(value: ReturnSettlement) {
  return value.isExchange
    ? { method: value.netPaymentMethod ?? "cash", amount: Number(value.netAmount) }
    : { method: value.refundMethod, amount: -Number(value.refundAmount) };
}
