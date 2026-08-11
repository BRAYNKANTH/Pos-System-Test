import Dexie, { type Table } from "dexie";

// Local-first offline queue (IndexedDB via Dexie). Only used client-side —
// checkout falls back to this when /api/pos/checkout can't be reached at
// all (network error), not on a normal server error response.
export type OfflinePayload = {
  items: { sku: string; qty: number }[];
  tenders: { method: string; amount: number }[];
  discount?: { scope: "cart"; type: "percent" | "amount"; value: number };
  shipping?: number;
  customerId?: string | null;
  registerId?: string;
};

export type OfflineTransaction = {
  id?: number;
  idempotencyKey: string;
  payload: OfflinePayload;
  createdAt: number;
};

class OfflineDB extends Dexie {
  pendingTransactions!: Table<OfflineTransaction, number>;

  constructor() {
    super("pos-offline");
    this.version(1).stores({
      pendingTransactions: "++id, idempotencyKey, createdAt",
    });
  }
}

// Dexie needs IndexedDB, which doesn't exist during SSR — only construct
// on the client.
export const offlineDB = typeof window !== "undefined" ? new OfflineDB() : null;
