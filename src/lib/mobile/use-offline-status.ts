"use client";

import { useEffect, useState } from "react";

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    const visibility = () => setIsVisible(document.visibilityState === "visible");

    sync();
    visibility();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    isVisible,
  };
}
