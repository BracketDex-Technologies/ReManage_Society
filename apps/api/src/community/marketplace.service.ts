import { Injectable } from "@nestjs/common";
import type {
  AuthenticatedPrincipal,
  PlatformRole,
  SocietyRole,
} from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  MarketplaceRepository,
  type CreateListingCommand,
  type ExpressInterestCommand,
  type ModerateListingCommand,
  type TransitionListingCommand,
} from "./marketplace.repository.js";

const MANAGER_ROLES: readonly (SocietyRole | PlatformRole)[] = [
  "committee",
  "society_admin",
  "platform_admin",
];

const VERIFIED_ROLES: readonly SocietyRole[] = [
  "resident",
  "committee",
  "treasurer",
  "society_admin",
];

export interface ListListingsCommand {
  societyId: string;
  userId: string;
  includeAll?: boolean;
}

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: MarketplaceRepository = new MarketplaceRepository(),
  ) {}

  async createListing(principal: AuthenticatedPrincipal, command: CreateListingCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:post", command.societyId);
    return this.repository.createListing(command);
  }

  async transitionListing(principal: AuthenticatedPrincipal, command: TransitionListingCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:post", command.societyId);
    return this.repository.transitionListing(command);
  }

  async expressInterest(principal: AuthenticatedPrincipal, command: ExpressInterestCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:post", command.societyId);
    return this.repository.expressInterest(command);
  }

  async moderateListing(principal: AuthenticatedPrincipal, command: ModerateListingCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:moderate", command.societyId);
    return this.repository.moderateListing(command);
  }

  async listListings(principal: AuthenticatedPrincipal, command: ListListingsCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", command.societyId);
    return this.repository.listListings(
      command.societyId,
      {
        userId: command.userId,
        isVerifiedResident: this.isVerifiedResident(principal, command.societyId),
        isManager: this.isManager(principal, command.societyId),
      },
      command.includeAll,
    );
  }

  private isManager(principal: AuthenticatedPrincipal, societyId: string): boolean {
    if (principal.platformRoles.includes("platform_admin")) {
      return true;
    }

    const membership = principal.memberships.find((m) => m.societyId === societyId);
    return Boolean(membership?.roles.some((role) => MANAGER_ROLES.includes(role)));
  }

  private isVerifiedResident(principal: AuthenticatedPrincipal, societyId: string): boolean {
    const membership = principal.memberships.find((m) => m.societyId === societyId);
    return Boolean(membership?.roles.some((role) => VERIFIED_ROLES.includes(role)));
  }
}
