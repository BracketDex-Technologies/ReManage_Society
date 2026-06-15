import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  AssetRepository,
  type CreateAssetCommand,
  type CreateVendorCommand,
  type RecordMaintenanceCommand,
} from "./asset.repository.js";

@Injectable()
export class AssetService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: AssetRepository = new AssetRepository(),
  ) {}

  async createVendor(principal: AuthenticatedPrincipal, command: CreateVendorCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.createVendor(command);
  }

  async listVendors(principal: AuthenticatedPrincipal, societyId: string, now = new Date()) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listVendors(societyId, now);
  }

  async createAsset(principal: AuthenticatedPrincipal, command: CreateAssetCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.createAsset(command);
  }

  async recordMaintenance(principal: AuthenticatedPrincipal, command: RecordMaintenanceCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:manage", command.societyId);
    return this.repository.recordMaintenance(command);
  }

  async listDueMaintenance(principal: AuthenticatedPrincipal, societyId: string, now = new Date()) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listDueMaintenance(societyId, now);
  }
}
