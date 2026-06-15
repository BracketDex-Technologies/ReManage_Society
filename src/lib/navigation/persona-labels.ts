import type { UxPersona } from "@society/ux-core";

export const PERSONA_LABELS: Record<UxPersona, string> = {
  committee: "Committee",
  treasurer: "Treasurer",
  resident: "Resident",
  guard: "Security",
  operations_desk: "Operations Desk",
  platform_admin: "Platform Admin",
  vendor: "Vendor",
};

export function getPersonaLabel(persona: UxPersona): string {
  return PERSONA_LABELS[persona];
}
