"use client";

import { useEffect } from "react";
import { mobileFetchJson } from "@/lib/mobile/mobile-fetch";
import { logMobileDiagnostic } from "@/lib/mobile/offline-db";

export function useMobileBootstrap() {
  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      mobileFetchJson("/api/mobile/bootstrap", {
        cacheKey: "mobile:bootstrap",
        ttlMs: 10 * 60_000,
      })
        .then(() => logMobileDiagnostic({
          type: "startup",
          message: "mobile_bootstrap_cached",
          metadata: { startupMs: Math.round(performance.now() - startedAt) },
        }))
        .catch(() => {});
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);
}
