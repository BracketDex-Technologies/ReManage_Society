"use client";

import { useEffect, useCallback } from "react";
import { enqueueOfflineRequest, logMobileDiagnostic } from "@/lib/mobile/offline-db";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const subJson = subscription.toJSON();
      
      // Send to our backend
      const payload = JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).catch(async () => {
        await enqueueOfflineRequest({
          url: "/api/push/subscribe",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          priority: "low",
          dedupeKey: `push-token:${subJson.endpoint}`,
        });
      });

      await logMobileDiagnostic({ type: "push", message: "push_subscription_ready" });
      return true;
    } catch (error) {
      console.error("Push subscription failed:", error);
      await logMobileDiagnostic({
        type: "push",
        message: "push_subscription_failed",
        metadata: { error: error instanceof Error ? error.message : "unknown" },
      });
      return false;
    }
  }, []);

  // Auto-subscribe on mount
  useEffect(() => {
    if (VAPID_PUBLIC_KEY) {
      // Delay to not block initial render
      const timer = setTimeout(() => {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            subscribe();
          } else if (permission === "denied") {
            logMobileDiagnostic({
              type: "push",
              message: "push_permission_denied",
            });
          }
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [subscribe]);

  return { subscribe };
}
