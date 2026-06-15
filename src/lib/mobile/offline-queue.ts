"use client";

import {
  getQueuedRequests,
  logMobileDiagnostic,
  removeQueuedRequest,
  updateQueuedRequest,
  type OfflineQueueItem,
} from "@/lib/mobile/offline-db";

const priorityWeight: Record<OfflineQueueItem["priority"], number> = {
  high: 0,
  normal: 1,
  low: 2,
};

let syncing = false;

function backoffMs(attempts: number) {
  return Math.min(30 * 60_000, 2_000 * 2 ** attempts);
}

export async function processOfflineQueue() {
  if (syncing || typeof navigator !== "undefined" && !navigator.onLine) return { processed: 0, failed: 0 };
  syncing = true;
  let processed = 0;
  let failed = 0;

  try {
    const now = Date.now();
    const items = (await getQueuedRequests())
      .filter((item) => item.nextRetryAt <= now)
      .sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || a.createdAt - b.createdAt)
      .slice(0, 8);

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
          cache: "no-store",
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        await removeQueuedRequest(item.id);
        processed++;
      } catch (error) {
        failed++;
        await updateQueuedRequest({
          ...item,
          attempts: item.attempts + 1,
          nextRetryAt: Date.now() + backoffMs(item.attempts + 1),
          lastError: error instanceof Error ? error.message : "Sync failed",
        });
      }
    }

    if (processed || failed) {
      await logMobileDiagnostic({
        type: "sync",
        message: "offline_queue_sync",
        metadata: { processed, failed },
      });
    }
  } finally {
    syncing = false;
  }

  window.dispatchEvent(new CustomEvent("mobile-queue-change"));
  return { processed, failed };
}
