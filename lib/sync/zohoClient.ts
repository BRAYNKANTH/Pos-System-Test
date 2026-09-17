import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

// Real Zoho Books OAuth 2.0 + API client. Everything here is genuine,
// working code — the only thing that can't be exercised without real
// Zoho developer credentials (ZOHO_CLIENT_ID/ZOHO_CLIENT_SECRET in .env)
// is actually reaching Zoho's servers. Without them, sendToZoho() throws
// a clear error that the worker (lib/sync/worker.ts) catches and records
// as a failed job — visible on /admin/sync-status, nothing else breaks.

const DATA_CENTERS = {
  com: { accounts: "https://accounts.zoho.com", books: "https://www.zohoapis.com/books/v3" },
  eu: { accounts: "https://accounts.zoho.eu", books: "https://www.zohoapis.eu/books/v3" },
  in: { accounts: "https://accounts.zoho.in", books: "https://www.zohoapis.in/books/v3" },
  "com.au": { accounts: "https://accounts.zoho.com.au", books: "https://www.zohoapis.com.au/books/v3" },
  jp: { accounts: "https://accounts.zoho.jp", books: "https://www.zohoapis.jp/books/v3" },
} as const;
export type DataCenter = keyof typeof DATA_CENTERS;
export const DATA_CENTER_KEYS = Object.keys(DATA_CENTERS) as DataCenter[];
export function isDataCenter(value: string): value is DataCenter {
  return value in DATA_CENTERS;
}

// Anti-CSRF nonce cookie for the OAuth round trip — see buildAuthorizeUrl.
export const OAUTH_STATE_COOKIE = "zoho_oauth_state";
export const OAUTH_STATE_MAX_AGE_S = 600;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — configure it in .env.local`);
  return value;
}

/** connectZohoOAuth — builds the URL to redirect the admin to. `state`
 * carries both the chosen data center (so the callback knows which data
 * center's token endpoint to use — an India-hosted Zoho org would
 * otherwise always fail against the "com" default) and a random,
 * per-attempt `nonce` the caller generated and stashed in a short-lived
 * cookie. Zoho echoes `state` back unchanged on the callback, which
 * checks the returned nonce against that cookie before exchanging any
 * code — without this, anyone could complete their own OAuth consent
 * with Zoho and hand the resulting `code` to a logged-in admin (e.g. via
 * a link), silently repointing the store's Zoho sync at the attacker's
 * own Zoho org (OAuth login CSRF). */
export function buildAuthorizeUrl(dataCenter: DataCenter = "com", nonce?: string): string {
  const clientId = requireEnv("ZOHO_CLIENT_ID");
  const redirectUri = requireEnv("ZOHO_REDIRECT_URI");
  const url = new URL(`${DATA_CENTERS[dataCenter].accounts}/oauth/v2/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "ZohoBooks.fullaccess.all");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", nonce ? `${dataCenter}:${nonce}` : dataCenter);
  return url.toString();
}

/** Splits the `state` value built by `buildAuthorizeUrl` back into its
 * data center and nonce parts. */
export function parseOAuthState(state: string): { dataCenter: string; nonce: string | null } {
  const sepIndex = state.indexOf(":");
  if (sepIndex === -1) return { dataCenter: state, nonce: null };
  return { dataCenter: state.slice(0, sepIndex), nonce: state.slice(sepIndex + 1) };
}

/** Token exchange after the OAuth redirect comes back with a `code`.
 * Stores the connection — single-branch assumption (one ZohoConnection
 * row keyed by branchId "default"); multi-branch mapBranchToOrg would
 * extend this to look up by branch/register instead. */
export async function exchangeCodeForToken(code: string, dataCenter: DataCenter = "com") {
  const clientId = requireEnv("ZOHO_CLIENT_ID");
  const clientSecret = requireEnv("ZOHO_CLIENT_SECRET");
  const redirectUri = requireEnv("ZOHO_REDIRECT_URI");

  const res = await fetch(`${DATA_CENTERS[dataCenter].accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Zoho token exchange failed: ${data.error ?? res.statusText}`);
  }

  return prisma.zohoConnection.upsert({
    where: { branchId: "default" },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      dataCenter,
    },
    create: {
      branchId: "default",
      organizationId: "", // set by the admin in /admin/settings/integrations once known
      dataCenter,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
}

/** refreshZohoToken — auto-refreshes before expiry. Called by
 * getValidAccessToken below, not on a separate schedule. */
export async function refreshZohoToken(connectionId: string) {
  const connection = await prisma.zohoConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const clientId = requireEnv("ZOHO_CLIENT_ID");
  const clientSecret = requireEnv("ZOHO_CLIENT_SECRET");
  const dc = (connection.dataCenter as DataCenter) || "com";

  const res = await fetch(`${DATA_CENTERS[dc].accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Zoho token refresh failed: ${data.error ?? res.statusText}`);
  }

  return prisma.zohoConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
}

type Connection = Awaited<ReturnType<typeof getValidConnection>>;

async function getValidConnection() {
  const connection = await prisma.zohoConnection.findUnique({ where: { branchId: "default" } });
  if (!connection) throw new Error("Not connected to Zoho — visit /admin/settings/integrations");
  if (!connection.organizationId) {
    throw new Error("Zoho Organization ID isn't set — visit /admin/settings/integrations");
  }

  // refresh if expiring within the next 2 minutes
  if (connection.expiresAt.getTime() - Date.now() < 2 * 60 * 1000) {
    return refreshZohoToken(connection.id);
  }
  return connection;
}

function booksUrl(connection: Connection, path: string, query: Record<string, string> = {}): string {
  const dc = (connection.dataCenter as DataCenter) || "com";
  const url = new URL(`${DATA_CENTERS[dc].books}${path}`);
  url.searchParams.set("organization_id", connection.organizationId);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

async function zohoFetch(
  connection: Connection,
  path: string,
  init: RequestInit = {},
  query: Record<string, string> = {},
) {
  const res = await fetch(booksUrl(connection, path, query), {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${connection.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Zoho API error (${res.status}): ${text}`);
  }
  return body;
}

/** Runs the "persist the returned Zoho id locally" step after a create
 * call that has already succeeded against Zoho's API. Deliberately
 * swallows errors instead of letting them propagate: if this throws
 * (e.g. an unexpected response shape), the real object already exists in
 * Zoho — letting the exception bubble up would mark the whole job
 * "failed"/retryable, and the next retry would create ANOTHER duplicate
 * since nothing was cached to skip it. Losing the local id cache just
 * means a future related sync might re-resolve via a fresh Zoho search
 * instead of the cache — much cheaper than a duplicate record. */
async function safeStore(entityLabel: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[zoho] created in Zoho but failed to store the returned id locally (${entityLabel}):`, err);
  }
}

/** findOrCreateContact — Zoho requires every invoice/credit note to
 * reference an existing Contact (`customer_id`); there's no "anonymous"
 * sale concept in Zoho Books. Searches by name first (idempotent across
 * repeat calls for the same walk-in bucket or same local Customer),
 * creates one if not found. Returns the Zoho `contact_id`. */
async function findOrCreateContact(
  connection: Connection,
  name: string,
  email?: string | null,
): Promise<string> {
  const search = await zohoFetch(connection, "/contacts", {}, { contact_name: name });
  const existing = (search.contacts as { contact_id: string; contact_name: string }[] | undefined)?.find(
    (c) => c.contact_name === name,
  );
  if (existing) return existing.contact_id;

  const created = await zohoFetch(connection, "/contacts", {
    method: "POST",
    body: JSON.stringify({ contact_name: name, email: email || undefined }),
  });
  return created.contact.contact_id as string;
}

/** findOrCreateItem — Zoho's Inventory Adjustments API (unlike invoices/
 * credit notes) requires line_items to reference its own product catalog
 * via `item_id`; ad-hoc name+rate lines aren't accepted there. Searches
 * by SKU first (Zoho's `sku` field), creates a catalog item if missing.
 * Returns the Zoho `item_id`. */
async function findOrCreateItem(
  connection: Connection,
  item: { sku: string; name: string; unitPrice: number },
): Promise<string> {
  const search = await zohoFetch(connection, "/items", {}, { sku: item.sku });
  const existing = (search.items as { item_id: string; sku: string }[] | undefined)?.find(
    (i) => i.sku === item.sku,
  );
  if (existing) return existing.item_id;

  const created = await zohoFetch(connection, "/items", {
    method: "POST",
    body: JSON.stringify({ name: item.name, sku: item.sku, rate: item.unitPrice }),
  });
  return created.item.item_id as string;
}

/** Resolves (and caches) the Zoho item_id for a local InventoryItem. */
async function resolveItemId(
  connection: Connection,
  item: { sku: string; name: string; unitPrice: number; zohoItemId: string | null },
): Promise<string> {
  if (item.zohoItemId) return item.zohoItemId;
  const itemId = await findOrCreateItem(connection, item);
  await prisma.inventoryItem.update({ where: { sku: item.sku }, data: { zohoItemId: itemId } });
  return itemId;
}

/** Resolves (and caches) the Zoho contact_id for a local Customer, or a
 * shared "Walk-In Customer" Zoho contact for anonymous sales. Persists
 * the id back onto the Customer row on first resolution so repeat sales
 * by the same customer don't create duplicate Zoho contacts. */
async function resolveContactId(
  connection: Connection,
  customer: { id: string; name: string; email: string | null; zohoContactId: string | null } | null,
): Promise<string> {
  if (customer?.zohoContactId) return customer.zohoContactId;

  const name = customer?.name ?? "Walk-In Customer";
  const contactId = await findOrCreateContact(connection, name, customer?.email);

  if (customer) {
    await prisma.customer.update({ where: { id: customer.id }, data: { zohoContactId: contactId } });
  }
  return contactId;
}

/** sendToZoho — resolves the right Zoho payload for an entity fresh from
 * the DB (not the enqueue-time snapshot in SyncQueueJob.payload, which is
 * kept small — see enqueueSyncJob call sites) and posts it.
 * `idempotencyKey` prevents duplicate records on retry, sent as Zoho's
 * `X-ZB-IDEMPOTENCY-KEY` header where supported. */
export async function sendToZoho(params: {
  entityType: "transaction" | "bill" | "stock_adjustment" | "customer" | "inventory_item";
  entityId: string;
  idempotencyKey: string;
}) {
  const connection = await getValidConnection();
  const idempotencyHeader = { "X-ZB-IDEMPOTENCY-KEY": params.idempotencyKey };

  switch (params.entityType) {
    case "customer": {
      const customer = await prisma.customer.findUniqueOrThrow({ where: { id: params.entityId } });
      // Guard against re-creating a duplicate Zoho contact on retry (a
      // job can be re-queued — e.g. via the sync-status "retry failed"
      // button — after it already succeeded once but failed to persist
      // that locally for some other reason). Every write below must be
      // gated the same way, per entity.
      if (customer.zohoContactId) {
        return { skipped: true, contact_id: customer.zohoContactId };
      }

      const result = await zohoFetch(connection, "/contacts", {
        method: "POST",
        headers: idempotencyHeader,
        body: JSON.stringify({ contact_name: customer.name, email: customer.email || undefined }),
      });
      await safeStore("customer", () =>
        prisma.customer.update({
          where: { id: customer.id },
          data: { zohoContactId: result.contact.contact_id },
        }),
      );
      return result;
    }

    case "transaction": {
      const transaction = await prisma.transaction.findUniqueOrThrow({
        where: { id: params.entityId },
        include: { items: true, customer: true },
      });
      if (transaction.zohoInvoiceId) {
        return { skipped: true, invoice_id: transaction.zohoInvoiceId };
      }

      const customerId = await resolveContactId(connection, transaction.customer);
      const skus = transaction.items.map((i) => i.sku);
      const inventoryItems = await prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });
      const nameBySku = new Map(inventoryItems.map((i) => [i.sku, i.name]));

      const result = await zohoFetch(connection, "/invoices", {
        method: "POST",
        headers: idempotencyHeader,
        body: JSON.stringify({
          customer_id: customerId,
          date: transaction.createdAt.toISOString().slice(0, 10),
          line_items: transaction.items.map((item) => ({
            name: nameBySku.get(item.sku) ?? item.sku,
            rate: Number(item.unitPrice),
            quantity: item.qty,
          })),
        }),
      });
      await safeStore("transaction", () =>
        prisma.transaction.update({
          where: { id: transaction.id },
          data: { zohoInvoiceId: result.invoice.invoice_id },
        }),
      );
      return result;
    }

    case "bill": {
      // Credit note for a quick-voided sale (see /api/pos/void/[id]).
      // Zoho credit notes need the same customer_id + line_items shape as
      // invoices — this credits the full original sale total as one line.
      // It's not linked back to the original Zoho invoice (Zoho's credit
      // note API doesn't take a parent invoice id on create), so
      // reconciling the two in Zoho Books is a manual step for now.
      const bill = await prisma.bill.findUniqueOrThrow({
        where: { id: params.entityId },
        include: { transaction: { include: { customer: true } } },
      });
      if (bill.zohoCreditNoteId) {
        return { skipped: true, creditnote_id: bill.zohoCreditNoteId };
      }

      const customerId = await resolveContactId(connection, bill.transaction.customer);

      const result = await zohoFetch(connection, "/creditnotes", {
        method: "POST",
        headers: idempotencyHeader,
        body: JSON.stringify({
          customer_id: customerId,
          date: new Date().toISOString().slice(0, 10),
          line_items: [
            {
              name: "Sale voided",
              rate: Number(bill.transaction.total),
              quantity: 1,
            },
          ],
        }),
      });
      await safeStore("bill", () =>
        prisma.bill.update({
          where: { id: bill.id },
          data: { zohoCreditNoteId: result.creditnote.creditnote_id },
        }),
      );
      return result;
    }

    case "stock_adjustment": {
      const adjustment = await prisma.stockAdjustment.findUniqueOrThrow({ where: { id: params.entityId } });
      if (adjustment.zohoAdjustmentId) {
        return { skipped: true, inventory_adjustment_id: adjustment.zohoAdjustmentId };
      }

      const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { sku: adjustment.sku } });
      const itemId = await resolveItemId(connection, {
        sku: item.sku,
        name: item.name,
        unitPrice: Number(item.unitPrice),
        zohoItemId: item.zohoItemId,
      });

      const result = await zohoFetch(connection, "/inventoryadjustments", {
        method: "POST",
        headers: idempotencyHeader,
        body: JSON.stringify({
          date: adjustment.createdAt.toISOString().slice(0, 10),
          reason: adjustment.reasonCategory || adjustment.type,
          adjustment_type: "quantity",
          line_items: [
            {
              item_id: itemId,
              quantity_adjusted: adjustment.qtyChange,
            },
          ],
        }),
      });
      await safeStore("stock_adjustment", () =>
        prisma.stockAdjustment.update({
          where: { id: adjustment.id },
          data: { zohoAdjustmentId: result.inventory_adjustment.inventory_adjustment_id },
        }),
      );
      return result;
    }

    case "inventory_item": {
      // Fired whenever a product is created or edited (see
      // app/api/inventory/route.ts POST and app/api/inventory/[sku]/route.ts
      // PATCH) — unlike resolveItemId (used by the stock_adjustment case,
      // which only needs SOME id and deliberately never re-pushes changes),
      // this path is specifically about pushing the product's current
      // name/price to Zoho, so an already-synced item still needs an
      // update call, not a skip.
      const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: params.entityId } });

      if (item.zohoItemId) {
        const result = await zohoFetch(connection, `/items/${item.zohoItemId}`, {
          method: "PUT",
          headers: idempotencyHeader,
          body: JSON.stringify({ name: item.name, rate: Number(item.unitPrice) }),
        });
        return result;
      }

      const itemId = await findOrCreateItem(connection, {
        sku: item.sku,
        name: item.name,
        unitPrice: Number(item.unitPrice),
      });
      await safeStore("inventory_item", () =>
        prisma.inventoryItem.update({ where: { id: item.id }, data: { zohoItemId: itemId } }),
      );
      return { item_id: itemId };
    }

    default:
      throw new Error(`No Zoho handler for entityType "${params.entityType}"`);
  }
}

/** pullInvoicePayments — the "other direction" of the sync: everything
 * above only ever pushes POS state INTO Zoho. This is the one pull path
 * back — when an accountant records a payment against a synced invoice
 * directly in Zoho Books (a bank transfer against an on-account/credit
 * sale, say), the POS never finds out on its own; the invoice just sits
 * showing as due forever even though it's actually settled. This checks
 * every locally-still-due, Zoho-synced transaction's live balance in
 * Zoho and, if Zoho shows more paid than the POS has tenders for,
 * records the gap as a new PaymentTender here (method "zoho_payment", so
 * it's visibly distinct from a tender actually taken at this terminal).
 *
 * There's no webhook endpoint wired up for this (that needs a public
 * HTTPS URL Zoho can reach, which a local dev environment doesn't have)
 * — this is polled instead, either on demand (see
 * POST /api/admin/sync/pull-payments, the "Pull Payments from Zoho"
 * button on /admin/sync-status) or periodically by scripts/worker.ts.
 * `actorId` is the admin who triggered a manual pull, for the audit
 * log — omitted for the worker's own periodic tick, which writes the
 * PaymentTender either way but skips the audit entry (there's no real
 * "actor" for a scheduled background check). */
export async function pullInvoicePayments(actorId?: string) {
  const connection = await getValidConnection();

  const candidates = await prisma.transaction.findMany({
    where: { status: "completed", zohoInvoiceId: { not: null } },
    include: { tenders: true },
  });
  const stillDue = candidates.filter((tx) => {
    const paid = tx.tenders.reduce((sum, t) => sum + Number(t.amount), 0);
    return paid < Number(tx.total) - 0.01;
  });

  const result = { checked: stillDue.length, updated: 0, errors: [] as { transactionId: string; message: string }[] };

  for (const tx of stillDue) {
    try {
      const body = await zohoFetch(connection, `/invoices/${tx.zohoInvoiceId}`);
      const invoice = body.invoice;
      if (!invoice) continue;

      const zohoPaid = Math.round((Number(invoice.total) - Number(invoice.balance)) * 100) / 100;
      const localPaid = Math.round(tx.tenders.reduce((sum, t) => sum + Number(t.amount), 0) * 100) / 100;
      const gap = Math.round((zohoPaid - localPaid) * 100) / 100;
      if (gap <= 0.01) continue;

      await prisma.paymentTender.create({
        data: { transactionId: tx.id, method: "zoho_payment", amount: gap },
      });
      if (actorId) {
        await writeAuditLog({
          entityType: "invoice_payment_pull",
          entityId: tx.id,
          oldValue: { localPaid },
          newValue: { zohoPaid, recordedGap: gap },
          actorId,
          reason: `Payment recorded in Zoho Books against invoice ${tx.zohoInvoiceId}`,
        });
      }
      result.updated++;
    } catch (err) {
      result.errors.push({ transactionId: tx.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}

/** Shared shape both the one-time catalog pull and the real-time item
 * webhook map onto an `InventoryItem` upsert. Only catalog/pricing
 * fields — `qtyOnHand` is deliberately left alone here (except on
 * first-ever create, where it starts at 0). The POS is the source of
 * truth for physical stock (sales deduct it, goods receipts add it);
 * letting Zoho's own stock figure overwrite it on every edit would fight
 * with that instead of reflecting what's actually on the shelf. */
type ZohoItemFields = {
  item_id: string;
  sku: string;
  name: string;
  rate?: string | number;
  purchase_rate?: string | number;
  category_name?: string | null;
  brand?: string | null;
  stock_on_hand?: string | number;
  available_stock?: string | number;
};

function catalogFieldsFromZohoItem(item: ZohoItemFields) {
  return {
    name: item.name,
    unitPrice: Number(item.rate ?? 0),
    purchasePrice: Number(item.purchase_rate ?? 0),
    category: item.category_name || null,
    brand: item.brand || null,
    zohoItemId: item.item_id,
  };
}

/** upsertProductFromZoho — used by both the webhook (one item at a time,
 * real-time) and pullAllProductsFromZoho (one page at a time, backfill).
 * Matches on `zohoItemId` first (set by a prior sync), falling back to
 * `sku` for an item Zoho has always owned but the POS is seeing for the
 * first time. */
async function upsertProductFromZoho(item: ZohoItemFields) {
  if (!item.sku) throw new Error(`Zoho item ${item.item_id} has no SKU — skipped`);

  const existing = await prisma.inventoryItem.findFirst({
    where: { OR: [{ zohoItemId: item.item_id }, { sku: item.sku }] },
  });

  const fields = catalogFieldsFromZohoItem(item);
  if (existing) {
    await prisma.inventoryItem.update({ where: { id: existing.id }, data: fields });
    return "updated" as const;
  }
  // Starting stock only applies on a brand-new product — there's no
  // existing POS reality to protect yet, and without this every freshly
  // imported item would sit at 0 until someone re-keys 10,000+ counts by
  // hand, which defeats the point of importing from Zoho at all.
  const startingQty = Math.max(0, Math.round(Number(item.stock_on_hand ?? item.available_stock ?? 0)));
  await prisma.inventoryItem.create({ data: { sku: item.sku, qtyOnHand: startingQty, ...fields } });
  return "created" as const;
}

/** pullAllProductsFromZoho — the one-time/on-demand "Import Products
 * from Zoho" button on /admin/sync-status. Fetches the full Zoho Books
 * item catalog (read-only `GET /items`, never writes anything back to
 * Zoho) and reconciles the local catalog to match it: every returned
 * item is upserted via upsertProductFromZoho, and any local product NOT
 * present in that set gets deleted — Zoho is treated as the sole source
 * of truth for the catalog. A product delete can fail on a foreign-key
 * constraint (it's been purchased, stocked, or adjusted before); that's
 * surfaced per-item in `result.errors` rather than aborting the whole
 * run. */
export async function pullAllProductsFromZoho(actorId?: string) {
  const connection = await getValidConnection();

  const result = {
    created: 0,
    updated: 0,
    removed: 0,
    pagesFetched: 0,
    stoppedEarly: false,
    errors: [] as { item: string; message: string }[],
  };
  const seenZohoIds = new Set<string>();

  let page = 1;
  for (;;) {
    let body: { items?: ZohoItemFields[]; page_context?: { has_more_page?: boolean } };
    try {
      body = await zohoFetch(connection, "/items", {}, { page: String(page), per_page: "200" });
    } catch (err) {
      // A later page failing (rate limit, transient network error) used
      // to throw out of the whole function, discarding this result
      // object — silently losing the record of everything already
      // imported from earlier pages even though those upserts had
      // already committed to the DB. Stop and report instead, so a
      // partial run is visibly partial rather than looking like either
      // a full success or a total failure.
      result.stoppedEarly = true;
      result.errors.push({ item: `page ${page}`, message: err instanceof Error ? err.message : String(err) });
      break;
    }
    result.pagesFetched = page;
    const items = body.items ?? [];
    if (page === 1 && items[0]) {
      // Diagnostic only — confirms the real field names/shape Zoho sent
      // for this org (rate/purchase_rate/stock_on_hand names, or lack
      // thereof, can vary by plan and item type), since a wrong
      // assumption here silently produces 0s rather than an error.
      console.log("[zoho pull] sample item from Zoho:", JSON.stringify(items[0]));
    }
    for (const item of items) {
      seenZohoIds.add(item.item_id);
      try {
        const outcome = await upsertProductFromZoho(item);
        result[outcome]++;
      } catch (err) {
        result.errors.push({ item: item.sku || item.item_id, message: err instanceof Error ? err.message : String(err) });
      }
    }
    if (!body.page_context?.has_more_page) break;
    page++;
  }

  // A run that stopped early only ever saw a partial slice of Zoho's
  // catalog — reconciling deletions against that partial `seenZohoIds`
  // would read as "Zoho doesn't have this" for products on pages that
  // were simply never reached, and delete them for real. Only safe to
  // prune local-only products once every page has actually been seen.
  const localOnly = result.stoppedEarly
    ? []
    : await prisma.inventoryItem.findMany({
        where: { zohoItemId: { notIn: Array.from(seenZohoIds) } },
        select: { id: true, sku: true, zohoItemId: true },
      });
  for (const product of localOnly) {
    // Never seen an item_id from Zoho for this product yet (zohoItemId
    // still null from before any sync ran) isn't the same claim as
    // "Zoho doesn't have this SKU" — skip those rather than risk
    // deleting something Zoho actually does own under a sku we haven't
    // linked yet.
    if (!product.zohoItemId) continue;
    try {
      await prisma.inventoryItem.delete({ where: { id: product.id } });
      result.removed++;
    } catch (err) {
      result.errors.push({ item: product.sku, message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (actorId) {
    await writeAuditLog({
      entityType: "product_catalog_pull",
      entityId: "zoho",
      newValue: result,
      actorId,
      reason: "Full product catalog imported from Zoho Books",
    });
  }

  return result;
}

/** handleZohoItemWebhook — the real-time counterpart to
 * pullAllProductsFromZoho: Zoho Books workflow rules call this
 * (POST /api/webhooks/zoho/items) on item create/edit so a single
 * change shows up in the POS immediately instead of waiting for the
 * next manual pull. Deliberately never deletes — an item removed in
 * Zoho stays in the POS until someone runs the full pull (or removes it
 * by hand), the same FK-safety reasoning as pullAllProductsFromZoho's
 * delete step, but there's no per-item "delete" trigger to react to
 * here even if that were desired. */
export async function handleZohoItemWebhook(item: ZohoItemFields) {
  return upsertProductFromZoho(item);
}
