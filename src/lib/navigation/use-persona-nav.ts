"use client";

import { useMemo } from "react";
import type { NavigationModel, QuickAction, UxPersona } from "@society/ux-core";
import { buildPersonaNavigation } from "./legacy-role-bridge";

export interface BottomNavItem {
  href: string;
  label: string;
  iconKey: string;
}

const BOTTOM_NAV_BY_PERSONA: Record<UxPersona, BottomNavItem[]> = {
  committee: [
    { href: "/dashboard", label: "Home", iconKey: "layout-dashboard" },
    { href: "/maintenance", label: "Collections", iconKey: "receipt" },
    { href: "/complaints", label: "Tickets", iconKey: "alert-triangle" },
    { href: "/visitors", label: "Gate", iconKey: "shield" },
    { href: "/notices", label: "Notices", iconKey: "megaphone" },
  ],
  treasurer: [
    { href: "/dashboard", label: "Home", iconKey: "layout-dashboard" },
    { href: "/maintenance", label: "Collections", iconKey: "receipt" },
    { href: "/expenses", label: "Expenses", iconKey: "wallet" },
    { href: "/reports", label: "Reports", iconKey: "bar-chart" },
  ],
  resident: [
    { href: "/dashboard", label: "Home", iconKey: "layout-dashboard" },
    { href: "/my-bills", label: "Bills", iconKey: "credit-card" },
    { href: "/complaints", label: "Tickets", iconKey: "alert-triangle" },
    { href: "/my-visitors", label: "Visitors", iconKey: "user-check" },
  ],
  guard: [
    { href: "/visitors", label: "Gate", iconKey: "shield" },
    { href: "/packages", label: "Parcels", iconKey: "package" },
    { href: "/emergency", label: "SOS", iconKey: "phone" },
  ],
  operations_desk: [
    { href: "/amenities", label: "Bookings", iconKey: "building" },
    { href: "/dashboard", label: "Home", iconKey: "layout-dashboard" },
    { href: "/notices", label: "Notices", iconKey: "megaphone" },
  ],
  platform_admin: [
    { href: "/system/sessions", label: "System", iconKey: "server" },
    { href: "/dashboard", label: "Home", iconKey: "layout-dashboard" },
  ],
  vendor: [
    { href: "/dashboard", label: "Home", iconKey: "layout-dashboard" },
  ],
};

export interface PersonaNavSession {
  subject: string;
  societyId: string;
  role: string;
  mfaVerified?: boolean;
  platformRoles?: readonly string[];
}

export interface PersonaNavState {
  persona: UxPersona;
  navigation: NavigationModel;
  quickActions: QuickAction[];
  bottomNav: BottomNavItem[];
}

export function selectPersonaNavState(session: PersonaNavSession): PersonaNavState {
  const { persona, navigation, quickActions } = buildPersonaNavigation(session);
  const allowedHrefs = new Set(
    navigation.sections.flatMap((section) => section.items.map((item) => item.href)),
  );

  const bottomNav = (BOTTOM_NAV_BY_PERSONA[persona] ?? []).filter((item) =>
    allowedHrefs.has(item.href) || item.href === "/dashboard" || item.href === "/system/sessions",
  );

  return { persona, navigation, quickActions, bottomNav };
}

export function usePersonaNav(session: PersonaNavSession | null) {
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  return useMemo(() => {
    if (!session?.societyId || !session.role) {
      return null;
    }

    return selectPersonaNavState(session);
    // eslint-disable-next-line react-hooks/preserve-manual-memoization, react-hooks/exhaustive-deps
  }, [session?.subject, session?.societyId, session?.role, session?.mfaVerified, session?.platformRoles]);
}
