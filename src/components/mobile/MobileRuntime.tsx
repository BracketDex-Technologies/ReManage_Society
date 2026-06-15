"use client";

import { CloudOff, DatabaseZap, Gauge, RotateCw } from "lucide-react";
import { useMobileSync } from "@/lib/mobile/use-mobile-sync";
import { useMobileBootstrap } from "@/lib/mobile/use-mobile-bootstrap";

export default function MobileRuntime() {
  useMobileBootstrap();
  const { isOffline, queueCount, syncing, lowBandwidth } = useMobileSync();

  return (
    <>
      {(isOffline || queueCount > 0 || lowBandwidth.enabled) && (
        <div className="fixed inset-x-3 bottom-[5.25rem] z-50 mx-auto max-w-md lg:bottom-4 lg:left-auto lg:right-4 lg:mx-0">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isOffline ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {isOffline ? <CloudOff className="h-5 w-5" /> : syncing ? <RotateCw className="h-5 w-5 animate-spin" /> : <DatabaseZap className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-text-primary">
                {isOffline ? "Offline mode active" : queueCount > 0 ? "Sync pending" : "Low bandwidth mode"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-text-secondary">
                {isOffline
                  ? "You can keep working. Changes will retry automatically."
                  : queueCount > 0
                    ? `${queueCount} action${queueCount === 1 ? "" : "s"} waiting to sync.`
                    : "Images, polling, and heavy refreshes are reduced."}
              </p>
            </div>
            {lowBandwidth.enabled && !isOffline && (
              <Gauge className="h-4 w-4 shrink-0 text-primary" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
