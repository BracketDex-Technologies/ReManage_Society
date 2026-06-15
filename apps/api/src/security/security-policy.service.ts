import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  evaluatePermission,
  type AuthenticatedPrincipal,
  type PermissionAction,
} from "../../../../packages/security/src/index.ts";

@Injectable()
export class SecurityPolicyService {
  authorizeOrThrow(
    principal: AuthenticatedPrincipal,
    action: PermissionAction,
    societyId: string,
  ) {
    const decision = evaluatePermission({ principal, action, societyId });

    if (!decision.allowed) {
      throw new ForbiddenException({
        error: "forbidden",
        reason: decision.reason,
      });
    }

    return decision;
  }
}

