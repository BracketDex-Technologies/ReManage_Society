import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { NotificationFoundationService } from "../security/notification-foundation.service.js";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  PackageRepository,
  type PackageCollectCommand,
  type PackageIntakeCommand,
  type PackageNotifyCommand,
  type PackageTransitionCommand,
} from "./package.repository.js";

@Injectable()
export class PackageService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly notifications: NotificationFoundationService,
    private readonly repository: PackageRepository = new PackageRepository(),
  ) {}

  async intakePackage(principal: AuthenticatedPrincipal, command: PackageIntakeCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.intakePackage(command);
  }

  async notifyPackage(
    principal: AuthenticatedPrincipal,
    command: PackageNotifyCommand & { flatId: string },
  ) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    const result = await this.repository.notifyPackage(command);
    const notification = this.notifications.createNotificationJob({
      societyId: command.societyId,
      recipientId: command.flatId,
      channel: "push",
      template: "package-arrived",
      payload: { id: command.packageId, packageId: command.packageId, flatId: command.flatId },
    });

    return { ...result, notification };
  }

  async collectPackage(principal: AuthenticatedPrincipal, command: PackageCollectCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.collectPackage(command);
  }

  async transitionPackage(principal: AuthenticatedPrincipal, command: PackageTransitionCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:gate.manage", command.societyId);
    return this.repository.transitionPackage(command);
  }

  async listPackages(principal: AuthenticatedPrincipal, societyId: string, status?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "operations:read", societyId);
    return this.repository.listPackages(societyId, status);
  }
}
