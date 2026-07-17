import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createAuditEvent, permissionsForRoles, type AuditEvent, type PermissionAction } from "../../../../../packages/security/src/index.ts";
import type { MobileInstallationDto } from "../auth/dto/mobile-auth.dto.ts";
import type { MobileIdentity } from "../auth/mobile-identity.repository.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import { defaultMobileRole } from "../common/mobile-role.ts";
import { MobileAccessTokenService } from "./mobile-access-token.service.ts";
import {
  MobileDeviceSessionRepository,
  MobileSessionCredentialError,
} from "./mobile-device-session.repository.ts";
import type { MobileAuthenticatedRequest } from "../common/mobile-request.ts";
import type { MobileRole } from "../common/mobile-role.ts";
import type { MobileBootstrapDto, MobileRoleSwitchDto, MobileSessionIssueDto } from "./dto/mobile-session.dto.ts";

export const MOBILE_SESSION_AUDIT = Symbol("MOBILE_SESSION_AUDIT");
export interface MobileSessionAudit { record(event: AuditEvent): Promise<void>; }

class MobileSessionAuditSink implements MobileSessionAudit {
  private readonly logger = new Logger(MobileSessionAuditSink.name);
  constructor(private readonly delivery: MobileSessionAudit) {}
  async record(event: AuditEvent): Promise<void> {
    try { await this.delivery.record(event); } catch { this.logger.warn("Mobile session audit delivery failed"); }
  }
}

@Injectable()
export class MobileSessionService {
  constructor(
    @Inject(MobileDeviceSessionRepository)
    private readonly sessions: Pick<
      MobileDeviceSessionRepository,
      "createSession" | "refresh" | "logout" | "findLiveSession" | "updateRole"
    >,
    @Inject(MobileAccessTokenService)
    private readonly accessTokens: Pick<MobileAccessTokenService, "issue">,
    @Inject(MobileConfigService)
    private readonly config: MobileConfigService,
    @Inject(MOBILE_SESSION_AUDIT) auditDelivery: MobileSessionAudit = { record: async () => undefined },
  ) {
    this.audit = new MobileSessionAuditSink(auditDelivery);
  }

  private readonly audit: MobileSessionAudit;

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
    let refreshed: Awaited<ReturnType<MobileDeviceSessionRepository["refresh"]>>;
    try {
      refreshed = await this.sessions.refresh(renewableCredential);
    } catch (error) {
      if (error instanceof MobileSessionCredentialError) {
        throw new UnauthorizedException({ error: "invalid_refresh" });
      }
      throw error;
    }
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
  }

  async logout(renewableCredential: string): Promise<{ loggedOut: true }> {
    try {
      await this.sessions.logout(renewableCredential);
    } catch (error) {
      if (!(error instanceof MobileSessionCredentialError)) {
        throw error;
      }
    }
    return { loggedOut: true };
  }

  async bootstrap(context: NonNullable<MobileAuthenticatedRequest["mobileSession"]>): Promise<MobileBootstrapDto> {
    const live = await this.sessions.findLiveSession(context.sessionId);
    if (!live || !this.matchesContext(live, context)) throw invalidSession();
    return this.bootstrapFor(live);
  }

  async switchRole(
    context: NonNullable<MobileAuthenticatedRequest["mobileSession"]>,
    role: MobileRole,
    requestId: string,
  ): Promise<MobileRoleSwitchDto> {
    const current = await this.sessions.findLiveSession(context.sessionId);
    if (!current || !this.matchesContext(current, context)) throw invalidSession();
    const requested = current.approvedRoles.find((assignment) => assignment.role === role);
    if (!requested) throw invalidSession();

    let updated;
    try {
      updated = await this.sessions.updateRole(current.session.id, requested.role, requested.permissionRole);
    } catch (error) {
      if (error instanceof MobileSessionCredentialError) throw invalidSession();
      throw error;
    }
    const live = await this.sessions.findLiveSession(current.session.id);
    if (!live || live.session.version !== updated.version || live.session.activeRole !== requested.role || live.session.activePermissionRole !== requested.permissionRole) {
      throw invalidSession();
    }
    const accessToken = await this.accessTokens.issue({
      sub: live.session.userId,
      sid: live.session.id,
      societyId: live.session.societyId,
      membershipId: live.session.membershipId,
      activeRole: live.session.activeRole,
      activePermissionRole: live.session.activePermissionRole,
      version: live.session.version,
      type: "mobile_access",
    });
    await this.audit.record(createAuditEvent({
      actorId: live.session.userId,
      societyId: live.session.societyId,
      action: "auth:login",
      targetType: "mobile_session",
      targetId: live.session.id,
      outcome: "allowed",
      requestId,
      metadata: { event: "mobile_role_switch", oldRole: current.session.activeRole, newRole: live.session.activeRole, sessionId: live.session.id },
    }));
    return {
      accessToken,
      accessExpiresAt: new Date(Date.now() + this.config.value.accessTokenTtlSeconds * 1_000).toISOString(),
      bootstrap: this.bootstrapFor(live),
    };
  }

  private matchesContext(
    live: Awaited<ReturnType<MobileDeviceSessionRepository["findLiveSession"]>>,
    context: NonNullable<MobileAuthenticatedRequest["mobileSession"]>,
  ): boolean {
    return live !== null && live.session.id === context.sessionId && live.session.userId === context.userId &&
      live.session.membershipId === context.membershipId && live.session.societyId === context.societyId &&
      live.session.activeRole === context.activeRole && live.session.activePermissionRole === context.activePermissionRole &&
      live.session.version === context.version && live.approvedRoles.some((assignment) => assignment.role === context.activeRole && assignment.permissionRole === context.activePermissionRole);
  }

  private bootstrapFor(live: NonNullable<Awaited<ReturnType<MobileDeviceSessionRepository["findLiveSession"]>>>): MobileBootstrapDto {
    return {
      user: live.user,
      society: live.society,
      approvedRoles: live.approvedRoles.map((assignment) => assignment.role),
      activeRole: live.session.activeRole,
      permissions: [...permissionsForRoles([live.session.activePermissionRole as "resident" | "member" | "tenant" | "guard"])] as PermissionAction[],
      featureFlags: { residentShell: true, guardShell: true, nativePush: false, guardOffline: false },
      notificationPolicy: {
        critical: { enabled: true, configurable: false },
        transactional: { enabled: true, configurable: true },
        community: { enabled: false, configurable: true },
      },
    };
  }
}

function invalidSession(): UnauthorizedException { return new UnauthorizedException({ error: "invalid_mobile_session" }); }
