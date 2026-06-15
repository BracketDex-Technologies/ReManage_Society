"use client";

import { useCallback, useEffect, useState } from "react";
import type { DuesEnforcementStatus } from "@/components/ux/DuesEnforcementBanner";

export function useDuesEnforcementStatus() {
  const [status, setStatus] = useState<DuesEnforcementStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dues/enforcement");
      const data = await res.json();
      if (res.ok) {
        setStatus(data.enforcement ?? null);
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, refresh, blocked: !!status?.blocked };
}
