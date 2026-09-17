import type { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { handleZohoItemWebhook } from "@/lib/sync/zohoClient";

// POST /api/webhooks/zoho/items — called by a Zoho Books workflow rule
// (Settings → Automation → Workflow Rules → Items → on Create/Edit →
// Webhook action) configured by hand in Zoho's own UI; nothing here can
// set that up from this codebase. Auth is a shared secret in the
// X-Webhook-Secret header (set as a custom header on that webhook
// action), since Zoho's generic webhook action doesn't sign requests.
export async function POST(req: NextRequest) {
  const secret = process.env.ZOHO_WEBHOOK_SECRET;
  if (!secret) return apiError("NOT_CONFIGURED", "ZOHO_WEBHOOK_SECRET isn't set", { status: 503 });
  if (req.headers.get("x-webhook-secret") !== secret) {
    return apiError("UNAUTHORIZED", "Invalid webhook secret", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.item_id || !body?.sku || !body?.name) {
    return apiError("INVALID_INPUT", "Expected item_id, sku, and name in the webhook body", { status: 400 });
  }

  try {
    const outcome = await handleZohoItemWebhook(body);
    return apiSuccess({ outcome, sku: body.sku });
  } catch (err) {
    console.error("[zoho webhook] failed to upsert item", body, err);
    return apiError("UPSERT_FAILED", err instanceof Error ? err.message : "Failed to apply item", { status: 500 });
  }
}
