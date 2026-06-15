"use client";

import type { ReactNode } from "react";
import { resolvePersona, type UxPersona } from "@society/ux-core";

interface PersonaDashboardRouterProps {
  role: string;
  platformRoles?: readonly string[];
  committee: ReactNode;
  treasurer: ReactNode;
  resident: ReactNode;
  guard: ReactNode;
  platformAdmin: ReactNode;
  operationsDesk?: ReactNode;
  vendor?: ReactNode;
}

export function resolveDashboardPersona(role: string, platformRoles?: readonly string[]): UxPersona {
  return resolvePersona(role, platformRoles);
}

export default function PersonaDashboardRouter({
  role,
  platformRoles,
  committee,
  treasurer,
  resident,
  guard,
  platformAdmin,
  operationsDesk,
  vendor,
}: PersonaDashboardRouterProps) {
  const persona = resolveDashboardPersona(role, platformRoles);

  switch (persona) {
    case "guard":
      return <>{guard}</>;
    case "treasurer":
      return <>{treasurer}</>;
    case "resident":
      return <>{resident}</>;
    case "platform_admin":
      return <>{platformAdmin}</>;
    case "operations_desk":
      return <>{operationsDesk ?? committee}</>;
    case "vendor":
      return <>{vendor ?? resident}</>;
    case "committee":
    default:
      return <>{committee}</>;
  }
}
