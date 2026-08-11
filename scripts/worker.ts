// Standalone sync worker process — `npm run worker`. Separate from the
// Next.js server since queue processing isn't part of the request
// lifecycle. Polls the sync_queue table every few seconds.
import { processSyncQueue } from "../lib/sync/worker";

const POLL_INTERVAL_MS = 5000;

async function tick() {
  try {
    const { checked, processed } = await processSyncQueue();
    if (processed > 0) {
      console.log(`[sync worker] checked ${checked}, processed ${processed}`);
    }
  } catch (err) {
    console.error("[sync worker] tick failed:", err);
  }
}

console.log(`[sync worker] starting, polling every ${POLL_INTERVAL_MS}ms`);

async function loop() {
  await tick();
  setTimeout(loop, POLL_INTERVAL_MS);
}

loop();
