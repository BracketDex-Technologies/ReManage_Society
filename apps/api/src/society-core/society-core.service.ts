import { Injectable } from "@nestjs/common";
import {
  buildResidentDirectory,
  createSocietySetupPlan,
  planOccupancyMove,
  validateSocietyImportRows,
  type DirectoryPerson,
  type DirectoryViewerRole,
  type ImportRowInput,
  type OccupancyMoveInput,
  type SocietySetupInput,
} from "../../../../packages/society-core/src/index.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  SocietyCoreRepository,
  type CredentialIssueInput,
} from "./society-core.repository.js";

@Injectable()
export class SocietyCoreService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: SocietyCoreRepository = new SocietyCoreRepository(),
  ) {}

  createSetupPlan(principal: AuthenticatedPrincipal, input: SocietySetupInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:core.manage", input.societyId);
    return createSocietySetupPlan(input);
  }

  dryRunImport(
    principal: AuthenticatedPrincipal,
    societyId: string,
    rows: readonly ImportRowInput[],
  ) {
    this.securityPolicy.authorizeOrThrow(principal, "society:import.manage", societyId);
    return validateSocietyImportRows(rows);
  }

  async commitSetupPlan(principal: AuthenticatedPrincipal, input: SocietySetupInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:core.manage", input.societyId);
    return this.repository.commitSetupPlan(input);
  }

  async commitImportRows(
    principal: AuthenticatedPrincipal,
    societyId: string,
    rows: readonly ImportRowInput[],
  ) {
    this.securityPolicy.authorizeOrThrow(principal, "society:import.manage", societyId);
    return this.repository.commitImportRows(societyId, rows);
  }

  planOccupancyMove(principal: AuthenticatedPrincipal, input: OccupancyMoveInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:occupancy.manage", input.societyId);
    return planOccupancyMove(input);
  }

  async commitOccupancyMove(principal: AuthenticatedPrincipal, input: OccupancyMoveInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:occupancy.manage", input.societyId);
    return this.repository.commitOccupancyMove(input);
  }

  async issueCredential(principal: AuthenticatedPrincipal, input: CredentialIssueInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:core.manage", input.societyId);
    return this.repository.issueCredential(input);
  }

  buildDirectory(
    principal: AuthenticatedPrincipal,
    societyId: string,
    people: readonly DirectoryPerson[],
  ) {
    this.securityPolicy.authorizeOrThrow(principal, "society:directory.read", societyId);
    return buildResidentDirectory(people, {
      role: resolveDirectoryRole(principal, societyId),
    });
  }

  async readDirectory(principal: AuthenticatedPrincipal, societyId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "society:directory.read", societyId);
    return this.repository.readDirectory(societyId, {
      role: resolveDirectoryRole(principal, societyId),
    });
  }
}

function resolveDirectoryRole(
  principal: AuthenticatedPrincipal,
  societyId: string,
): DirectoryViewerRole {
  const membership = principal.memberships.find((candidate) => candidate.societyId === societyId);
  const roles = membership?.roles ?? [];

  if (roles.includes("society_admin")) {
    return "society_admin";
  }

  if (roles.includes("committee")) {
    return "committee";
  }

  if (roles.includes("treasurer")) {
    return "treasurer";
  }

  return "resident";
}
