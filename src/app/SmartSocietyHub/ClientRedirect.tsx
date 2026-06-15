"use client";

import { useLayoutEffect } from "react";

export default function SmartSocietyHubClientRedirect({
  destination,
}: {
  destination: string;
}) {
  useLayoutEffect(() => {
    const path = window.location.pathname;
    if (path === "/SmartSocietyHub" || path === "/SmartSocietyHub/") {
      window.location.replace(destination);
    }
  }, [destination]);

  return null;
}
