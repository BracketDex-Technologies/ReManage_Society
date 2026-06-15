import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  StaffRepository,
  type AttendanceCheckInCommand,
  type AttendanceCheckOutCommand,
  type StaffFlatLinkCommand,
  type StaffRegisterCommand,
} from "./staff.repository.js";

@Injectable()
export class StaffService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: StaffRepository = new StaffRepository(),
  ) {}

  async registerStaff(principal: AuthenticatedPrincipal, command: StaffRegisterCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.registerStaff(command);
  }

  async linkStaffToFlat(principal: AuthenticatedPrincipal, command: StaffFlatLinkCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.linkStaffToFlat(command);
  }

  async markCheckIn(principal: AuthenticatedPrincipal, command: AttendanceCheckInCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.markCheckIn(command);
  }

  async markCheckOut(principal: AuthenticatedPrincipal, command: AttendanceCheckOutCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.markCheckOut(command);
  }

  async listStaff(principal: AuthenticatedPrincipal, societyId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listStaff(societyId);
  }

  async listAttendance(principal: AuthenticatedPrincipal, societyId: string, staffId?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listAttendance(societyId, staffId);
  }
}
