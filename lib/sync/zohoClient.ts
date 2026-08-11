import { prisma } from "@/lib/prisma";

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — configure it in .env.local`);
  return value;
}

/** connectZohoOAuth — builds the URL to redirect the admin to. Passes the
 * chosen data center back as `state`, which Zoho echoes back unchanged on
 * the callback — that's how the callback route knows which data center's
 * token endpoint to use for the code exchange (the account's actual data
 * center, e.g. an India-hosted Zoho org, would otherwise always fail
 * against the "com" default). */
export function buildAuthorizeUrl(dataCenter: DataCenter = "com"): string {
  const clientId = requireEnv("ZOHO_CLIENT_ID");
  const redirectUri = requireEnv("ZOHO_REDIRECT_URI");
  const url = new URL(`${DATA_CENTERS[dataCenter].accounts}/oauth/v2/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "ZohoBooks.fullaccess.all");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", dataCenter);
  return url.toString();
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
  entityType: "transaction" | "bill" | "stock_adjustment" | "customer";
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
      // Credit note for an approved bill change (refund/void/correction).
      // Zoho credit notes need the same customer_id + line_items shape as
      // invoices. There's no guaranteed structured "amount" on
      // BillChangeRequest.proposedChanges (it's free-form JSON set by
      // whatever the client sent), so this credits the full original sale
      // total as one line, described by the change's reason — an honest
      // approximation, not a partial-amount credit. It's also not linked
      // back to the original Zoho invoice (Zoho's credit note API doesn't
      // take a parent invoice id on create), so reconciling the two in
      // Zoho Books is a manual step for now.
      const bill = await prisma.bill.findUniqueOrThrow({
        where: { id: params.entityId },
        include: { transaction: { include: { customer: true } }, changeRequests: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (bill.zohoCreditNoteId) {
        return { skipped: true, creditnote_id: bill.zohoCreditNoteId };
      }

      const latestRequest = bill.changeRequests[0];
      const customerId = await resolveContactId(connection, bill.transaction.customer);

      const result = await zohoFetch(connection, "/creditnotes", {
        method: "POST",
        headers: idempotencyHeader,
        body: JSON.stringify({
          customer_id: customerId,
          date: new Date().toISOString().slice(0, 10),
          line_items: [
            {
              name: `Bill adjustment${latestRequest ? ` (${latestRequest.type}): ${latestRequest.reason}` : ""}`,
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

    default:
      throw new Error(`No Zoho handler for entityType "${params.entityType}"`);
  }
}
