import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { NotificationFoundationService } from "../security/notification-foundation.service.js";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  IncidentRepository,
  type AddBlacklistCommand,
  type CheckBlacklistCommand,
  type RaiseSosCommand,
  type ReportIncidentCommand,
} from "./incident.repository.js";

@Injectable()
export class IncidentService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly notifications: NotificationFoundationService,
    private readonly repository: IncidentRepository = new IncidentRepository(),
  ) {}

  async reportIncident(principal: AuthenticatedPrincipal, command: ReportIncidentCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.reportIncident(command);
  }

  async raiseSos(principal: AuthenticatedPrincipal, command: RaiseSosCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:sos.raise", command.societyId);
    const result = await this.repository.raiseSos(command);
    const notifications = result.escalation.tiers.map((tier) =>
      this.notifications.createNotificationJob({
        societyId: command.societyId,
        recipientId: tier,
        channel: "push",
        template: "sos-alert",
        payload: { id: result.incidentId, incidentId: result.incidentId, severity: result.escalation.severity },
      }),
    );

    return { ...result, notifications };
  }

  async addBlacklist(principal: AuthenticatedPrincipal, command: AddBlacklistCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.addBlacklist(command);
  }

  async checkBlacklist(principal: AuthenticatedPrincipal, command: CheckBlacklistCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.checkBlacklist(command);
  }

  async listIncidents(principal: AuthenticatedPrincipal, societyId: string, status?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listIncidents(societyId, status);
  }
}
