import { Inject, Injectable } from "@nestjs/common";
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
    private readonly sessions: Pick<MobileDeviceSessionRepository, "createSession">,
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
}
