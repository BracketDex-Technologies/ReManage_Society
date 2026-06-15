import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  AmenityRepository,
  type AddScheduleCommand,
  type CancelBookingCommand,
  type CreateAmenityCommand,
  type CreateBookingCommand,
  type JoinWaitlistCommand,
  type UpsertPolicyCommand,
} from "./amenity.repository.js";

@Injectable()
export class AmenityService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: AmenityRepository = new AmenityRepository(),
  ) {}

  async createAmenity(principal: AuthenticatedPrincipal, command: CreateAmenityCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.createAmenity(command);
  }

  async upsertPolicy(principal: AuthenticatedPrincipal, command: UpsertPolicyCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.upsertPolicy(command);
  }

  async addSchedule(principal: AuthenticatedPrincipal, command: AddScheduleCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.addSchedule(command);
  }

  async createBooking(principal: AuthenticatedPrincipal, command: CreateBookingCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:booking.manage", command.societyId);
    const membership = principal.memberships.find((entry) => entry.societyId === command.societyId);
    const skipDuesEnforcement =
      membership?.roles.some((role) =>
        role === "treasurer" || role === "committee" || role === "society_admin",
      ) ?? false;
    return this.repository.createBooking({ ...command, skipDuesEnforcement });
  }

  async cancelBooking(principal: AuthenticatedPrincipal, command: CancelBookingCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:booking.manage", command.societyId);
    return this.repository.cancelBooking(command);
  }

  async joinWaitlist(principal: AuthenticatedPrincipal, command: JoinWaitlistCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:booking.manage", command.societyId);
    const membership = principal.memberships.find((entry) => entry.societyId === command.societyId);
    const skipDuesEnforcement =
      membership?.roles.some((role) =>
        role === "treasurer" || role === "committee" || role === "society_admin",
      ) ?? false;
    return this.repository.joinWaitlist({ ...command, skipDuesEnforcement });
  }

  async listBookings(principal: AuthenticatedPrincipal, societyId: string, facilityId?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listBookings(societyId, facilityId);
  }
}
