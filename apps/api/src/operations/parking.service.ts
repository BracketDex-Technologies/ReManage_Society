import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  ParkingRepository,
  type AssignSlotCommand,
  type CreateSlotCommand,
  type CreateZoneCommand,
  type ReleaseSlotCommand,
} from "./parking.repository.js";

@Injectable()
export class ParkingService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: ParkingRepository = new ParkingRepository(),
  ) {}

  async createZone(principal: AuthenticatedPrincipal, command: CreateZoneCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.createZone(command);
  }

  async createSlot(principal: AuthenticatedPrincipal, command: CreateSlotCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.createSlot(command);
  }

  async assignSlot(principal: AuthenticatedPrincipal, command: AssignSlotCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.assignSlot(command);
  }

  async releaseSlot(principal: AuthenticatedPrincipal, command: ReleaseSlotCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.releaseSlot(command);
  }

  async listSlots(principal: AuthenticatedPrincipal, societyId: string, zoneId?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listSlots(societyId, zoneId);
  }

  async capacity(principal: AuthenticatedPrincipal, societyId: string, zoneId?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.capacity(societyId, zoneId);
  }
}
