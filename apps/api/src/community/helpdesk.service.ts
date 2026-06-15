import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  HelpdeskRepository,
  type AssignComplaintCommand,
  type EscalateComplaintCommand,
  type RaiseComplaintCommand,
  type RateComplaintCommand,
  type TransitionComplaintCommand,
} from "./helpdesk.repository.js";

@Injectable()
export class HelpdeskService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: HelpdeskRepository = new HelpdeskRepository(),
  ) {}

  async raiseComplaint(principal: AuthenticatedPrincipal, command: RaiseComplaintCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:helpdesk.respond", command.societyId);
    return this.repository.raiseComplaint(command);
  }

  async assignComplaint(principal: AuthenticatedPrincipal, command: AssignComplaintCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:helpdesk.manage", command.societyId);
    return this.repository.assignComplaint(command);
  }

  async transitionComplaint(principal: AuthenticatedPrincipal, command: TransitionComplaintCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:helpdesk.manage", command.societyId);
    return this.repository.transitionComplaint(command);
  }

  async escalateComplaint(principal: AuthenticatedPrincipal, command: EscalateComplaintCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:helpdesk.manage", command.societyId);
    return this.repository.escalateComplaint(command);
  }

  async rateComplaint(principal: AuthenticatedPrincipal, command: RateComplaintCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:helpdesk.respond", command.societyId);
    return this.repository.rateComplaint(command);
  }

  async listComplaints(
    principal: AuthenticatedPrincipal,
    societyId: string,
    status?: string,
  ) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return this.repository.listComplaints(societyId, { status, now: new Date() });
  }
}
