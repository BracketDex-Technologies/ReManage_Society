import type { AuthenticatedPrincipal } from "../../../../../packages/security/src/index.ts";
import type { FastifyRequest } from "fastify";
import type { MobileRole } from "./mobile-role.ts";

export interface MobileAuthenticatedRequest extends FastifyRequest {
  mobileSession?: {
    sessionId: string;
    userId: string;
    membershipId: string;
    societyId: string;
    activeRole: MobileRole;
    activePermissionRole: string;
    version: number;
  };
  principal?: AuthenticatedPrincipal;
}
