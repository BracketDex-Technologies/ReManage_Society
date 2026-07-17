import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { MobileInstallationDto } from "../auth/dto/mobile-auth.dto.ts";
import type { MobileIdentity } from "../auth/mobile-identity.repository.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import { defaultMobileRole } from "../common/mobile-role.ts";
import { MobileAccessTokenService } from "./mobile-access-token.service.ts";
import { MobileDeviceSessionRepository } from "./mobile-device-session.repository.ts";
import type { MobileSessionIssueDto } from "./dto/mobile-session.dto.ts";

@Injectable()
export class MobileSessionService {
  constructor(
    @Inject(MobileDeviceSessionRepository)
    private readonly sessions: Pick<
      MobileDeviceSessionRepository,
      "createSession" | "refresh" | "logout"
    >,
    @Inject(MobileAccessTokenService)
    private readonly accessTokens: Pick<MobileAccessTokenService, "issue">,
    @Inject(MobileConfigService)
    private readonly config: MobileConfigService,
  ) {}

  async issueForIdentity(
    identity: MobileIdentity,
    installation: MobileInstallationDto,
  ): Promise<MobileSessionIssueDto> {
    const activeRole = defaultMobileRole(identity.roles.map((assignment) => assignment.role));
    const activeAssignment = identity.roles.find(
      (assignment) => assignment.role === activeRole,
    );
    if (!activeAssignment) {
      throw new Error("Default mobile role must have an approved assignment");
    }

    const renewable = await this.sessions.createSession({
      userId: identity.userId,
      membershipId: identity.membershipId,
      societyId: identity.societyId,
      installationId: installation.id,
      platform: installation.platform,
      appVersion: installation.appVersion,
      deviceName: installation.deviceName,
      activeRole,
      activePermissionRole: activeAssignment.permissionRole,
    });
    const accessToken = await this.accessTokens.issue({
      sub: identity.userId,
      sid: renewable.sessionId,
      societyId: identity.societyId,
      membershipId: identity.membershipId,
      activeRole,
      activePermissionRole: activeAssignment.permissionRole,
      version: renewable.version,
      type: "mobile_access",
    });

    return {
      accessToken,
      accessExpiresAt: new Date(
        Date.now() + this.config.value.accessTokenTtlSeconds * 1_000,
      ).toISOString(),
      renewableCredential: renewable.credential,
      renewableExpiresAt: renewable.expiresAt.toISOString(),
      deviceSessionId: renewable.sessionId,
      activeRole,
    };
  }

  async refresh(renewableCredential: string): Promise<MobileSessionIssueDto> {
    try {
      const refreshed = await this.sessions.refresh(renewableCredential);
      const accessToken = await this.accessTokens.issue({
        sub: refreshed.userId,
        sid: refreshed.sessionId,
        societyId: refreshed.societyId,
        membershipId: refreshed.membershipId,
        activeRole: refreshed.activeRole,
        activePermissionRole: refreshed.activePermissionRole,
        version: refreshed.version,
        type: "mobile_access",
      });
      return {
        accessToken,
        accessExpiresAt: new Date(
          Date.now() + this.config.value.accessTokenTtlSeconds * 1_000,
        ).toISOString(),
        renewableCredential: refreshed.credential,
        renewableExpiresAt: refreshed.expiresAt.toISOString(),
        deviceSessionId: refreshed.sessionId,
        activeRole: refreshed.activeRole,
      };
    } catch {
      throw new UnauthorizedException({ error: "invalid_refresh" });
    }
  }

  async logout(renewableCredential: string): Promise<{ loggedOut: true }> {
    try {
      await this.sessions.logout(renewableCredential);
    } catch {
      // Logout is intentionally non-enumerating and idempotent.
    }
    return { loggedOut: true };
  }
}
