"use client";

import { useEffect, useState } from "react";
import { getMobileSetting, setMobileSetting } from "@/lib/mobile/offline-db";
import { connectionQuality } from "@/lib/mobile/mobile-fetch";

export function useLowBandwidthMode() {
  const [manualLowData, setManualLowData] = useState(false);
  const [quality, setQuality] = useState("unknown");

  useEffect(() => {
    getMobileSetting("lowBandwidthMode", false).then(setManualLowData);

    const update = () => setQuality(connectionQuality());
    update();

    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    connection?.addEventListener?.("change", update);
    return () => connection?.removeEventListener?.("change", update);
  }, []);

  const enabled = manualLowData || quality === "poor" || quality === "save-data";

  return {
    enabled,
    quality,
    manualLowData,
    setManualLowData: async (next: boolean) => {
      setManualLowData(next);
      await setMobileSetting("lowBandwidthMode", next);
      window.dispatchEvent(new CustomEvent("mobile-low-bandwidth-change", { detail: next }));
    },
  };
}
