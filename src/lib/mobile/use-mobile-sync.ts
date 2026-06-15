"use client";

import { useEffect, useState } from "react";
import { getQueueCount } from "@/lib/mobile/offline-db";
import { processOfflineQueue } from "@/lib/mobile/offline-queue";
import { useOfflineStatus } from "@/lib/mobile/use-offline-status";
import { useLowBandwidthMode } from "@/lib/mobile/use-low-bandwidth";

export function useMobileSync() {
  const { isOnline, isVisible } = useOfflineStatus();
  const lowBandwidth = useLowBandwidthMode();
  const [queueCount, setQueueCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refreshCount = () => getQueueCount().then(setQueueCount);
    refreshCount();
    window.addEventListener("mobile-queue-change", refreshCount);
    return () => window.removeEventListener("mobile-queue-change", refreshCount);
  }, []);

  useEffect(() => {
    if (!isOnline || !isVisible) return;

    const run = async () => {
      setSyncing(true);
      try {
        await processOfflineQueue();
        setLastSyncAt(Date.now());
        setQueueCount(await getQueueCount());
      } finally {
        setSyncing(false);
      }
    };

    run();
    const intervalMs = lowBandwidth.enabled ? 120_000 : 45_000;
    const id = window.setInterval(run, intervalMs);
    return () => window.clearInterval(id);
  }, [isOnline, isVisible, lowBandwidth.enabled]);

  return {
    isOnline,
    isOffline: !isOnline,
    isVisible,
    queueCount,
    syncing,
    lastSyncAt,
    lowBandwidth,
    syncNow: processOfflineQueue,
  };
}
