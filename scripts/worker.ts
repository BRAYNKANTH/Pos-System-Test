// Standalone sync worker process — `npm run worker`. Separate from the
// Next.js server since queue processing isn't part of the request
// lifecycle. Polls the sync_queue table every few seconds (push jobs:
// POS → Zoho), and — far less often — pulls payment updates the other
// way (Zoho → POS, see pullInvoicePayments' docs in lib/sync/zohoClient).
import { processSyncQueue } from "../lib/sync/worker";
import { pullInvoicePayments } from "../lib/sync/zohoClient";

const POLL_INTERVAL_MS = 5000;
// Checking Zoho for payment updates is a real API call per still-due
// invoice, not a cheap local queue read — once a minute is plenty for
// "an accountant recorded a payment sometime today," so this only runs
// every 12th tick instead of every tick.
const PULL_EVERY_N_TICKS = 12;
let tickCount = 0;

async function tick() {
  try {
    const { checked, processed } = await processSyncQueue();
    if (processed > 0) {
      console.log(`[sync worker] checked ${checked}, processed ${processed}`);
    }
  } catch (err) {
    console.error("[sync worker] tick failed:", err);
  }

  tickCount++;
  if (tickCount % PULL_EVERY_N_TICKS === 0) {
    try {
      const result = await pullInvoicePayments();
      if (result.updated > 0) {
        console.log(`[sync worker] pulled ${result.updated} payment(s) from Zoho (checked ${result.checked})`);
      }
      if (result.errors.length > 0) {
        console.error(`[sync worker] ${result.errors.length} error(s) pulling payments:`, result.errors);
      }
    } catch (err) {
      // Not connected to Zoho yet, or the org id isn't set — both are
      // completely normal states for this app (see /admin/settings/
      // integrations), not something to crash the worker over.
      console.log("[sync worker] skipped payment pull:", err instanceof Error ? err.message : err);
    }
  }
}

console.log(`[sync worker] starting, polling every ${POLL_INTERVAL_MS}ms`);

async function loop() {
  await tick();
  setTimeout(loop, POLL_INTERVAL_MS);
}

loop();
