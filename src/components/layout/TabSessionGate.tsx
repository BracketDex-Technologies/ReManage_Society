"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTabSessionToken } from "@/lib/client-session";
import { canAccess, getDefaultRoute } from "@/lib/role-access";
import { useUser } from "@/lib/user-context";

export default function TabSessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loaded } = useUser();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    setHasToken(Boolean(getTabSessionToken()));
  }, []);

  useEffect(() => {
    if (hasToken === false) {
      router.replace("/login");
    }
  }, [hasToken, router]);

  useEffect(() => {
    if (!loaded || !user.role || !user.societyId || hasToken !== true) return;

    const allowed = canAccess(user.role, pathname, {
      societyId: user.societyId,
      subject: user.id || user.email || "user",
    });

    if (!allowed) {
      router.replace(getDefaultRoute(user.role));
    }
  }, [hasToken, loaded, pathname, router, user.email, user.id, user.role, user.societyId]);

  if (hasToken === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="spinner !w-8 !h-8" />
      </div>
    );
  }

  if (!hasToken) {
    return null;
  }

  return <>{children}</>;
}
