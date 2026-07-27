import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedPrincipal, SocietyRole } from "../../../../../packages/security/src/index.ts";
import type { MobileAuthenticatedRequest } from "../common/mobile-request.ts";
import { isPermissionRoleValidForMobileRole } from "../common/mobile-role.ts";
import { MobileAccessTokenService } from "./mobile-access-token.service.ts";
import { MobileDeviceSessionRepository } from "./mobile-device-session.repository.ts";

@Injectable()
export class MobileSessionGuard implements CanActivate {
  constructor(
    @Inject(MobileAccessTokenService)
    private readonly accessTokens: Pick<MobileAccessTokenService, "verify">,
    @Inject(MobileDeviceSessionRepository)
    private readonly sessions: Pick<MobileDeviceSessionRepository, "findLiveSession">,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MobileAuthenticatedRequest>();
    const token = bearerToken(request.headers.authorization);
    if (!token) throw invalidSession();

    let claims;
    try {
      claims = await this.accessTokens.verify(token);
    } catch {
      throw invalidSession();
    }

    const live = await this.sessions.findLiveSession(claims.sid);
    if (!live ||
      live.session.id !== claims.sid ||
      live.session.userId !== claims.sub ||
      live.session.societyId !== claims.societyId ||
      live.session.membershipId !== claims.membershipId ||
      live.session.activeRole !== claims.activeRole ||
      live.session.activePermissionRole !== claims.activePermissionRole ||
      live.session.version !== claims.version ||
      !isPermissionRoleValidForMobileRole(claims.activeRole, claims.activePermissionRole) ||
      !live.approvedRoles.some((assignment) =>
        assignment.role === claims.activeRole &&
        assignment.permissionRole === claims.activePermissionRole,
      )) {
      throw invalidSession();
    }

    request.mobileSession = {
      sessionId: live.session.id,
      userId: live.session.userId,
      membershipId: live.session.membershipId,
      societyId: live.session.societyId,
      activeRole: live.session.activeRole,
      activePermissionRole: live.session.activePermissionRole,
      version: live.session.version,
    };
    request.principal = activePrincipal(request.mobileSession);
    return true;
  }
}

function bearerToken(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const match = /^Bearer ([^\s]+)$/.exec(value);
  return match?.[1] ?? null;
}

function activePrincipal(session: NonNullable<MobileAuthenticatedRequest["mobileSession"]>): AuthenticatedPrincipal {
  return {
    subject: session.userId,
    memberships: [{ societyId: session.societyId, roles: [session.activePermissionRole as SocietyRole], mfaVerified: false }],
    platformRoles: [],
  };
}

function invalidSession(): UnauthorizedException {
  return new UnauthorizedException({ error: "invalid_mobile_session" });
}
