import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  VisitorRepository,
  type PatrolScanCommand,
  type VisitorLogCommand,
  type VisitorRespondCommand,
  type VisitorTransitionCommand,
} from "./visitor.repository.js";

@Injectable()
export class VisitorService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: VisitorRepository = new VisitorRepository(),
  ) {}

  async logVisitor(principal: AuthenticatedPrincipal, command: VisitorLogCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.logVisitor(command);
  }

  async respondToVisitor(principal: AuthenticatedPrincipal, command: VisitorRespondCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:visitor.respond", command.societyId);
    return this.repository.respondToVisitor(command);
  }

  async transitionVisitor(principal: AuthenticatedPrincipal, command: VisitorTransitionCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.transitionVisitor(command);
  }

  async listVisitors(principal: AuthenticatedPrincipal, societyId: string, status?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listVisitors(societyId, status);
  }

  async scanPatrol(principal: AuthenticatedPrincipal, command: PatrolScanCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.scanPatrol(command);
  }

  async listPatrols(principal: AuthenticatedPrincipal, societyId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listPatrols(societyId);
  }
}
