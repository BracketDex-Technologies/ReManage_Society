"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setTabSessionToken } from "@/lib/client-session";

export default function AuthCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const next = searchParams.get("next") || "/dashboard";

    if (!token) {
      router.replace("/login?error=missing_session");
      return;
    }

    setTabSessionToken(token);
    router.replace(next);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="spinner !w-8 !h-8" />
    </div>
  );
}
