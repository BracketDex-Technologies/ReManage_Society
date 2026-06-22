"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { usePersonaNav } from "@/lib/navigation/use-persona-nav";

export default function GuardRedirect() {
  const { user, loaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const personaNav = usePersonaNav(
    loaded && user.societyId
      ? {
          subject: user.id || user.email || "user",
          societyId: user.societyId,
          role: user.role,
        }
      : null,
  );

  useEffect(() => {
    if (!loaded || !personaNav) return;
    if (personaNav.persona !== "guard") return;
    if (pathname === "/dashboard") {
      router.replace(personaNav.navigation.defaultRoute);
    }
  }, [loaded, pathname, personaNav, router]);

  return null;
}
