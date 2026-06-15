import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  applyPackageTransition,
  generatePickupOtp,
  planPackageIntake,
  verifyPackagePickup,
  type PackageStatus,
} from "../../../../packages/operations-core/src/index.ts";

interface PackageRecord {
  id: string;
  societyId: string;
  flatId: string;
  status: string;
  pickupOtp?: string | null;
}

export interface PackagePersistenceClient {
  package: {
    findFirst(input: Record<string, unknown>): Promise<PackageRecord | null>;
    findUnique(input: { where: { id: string } }): Promise<PackageRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<PackageRecord>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<PackageRecord>;
    findMany(input: Record<string, unknown>): Promise<PackageRecord[]>;
  };
}

export interface PackageIntakeCommand {
  societyId: string;
  flatId: string;
  courierName?: string;
  description?: string;
  photoUrl?: string;
  loggedBy: string;
  receivedAt: Date;
}

export interface PackageIntakeResult {
  logged: true;
  replayed: boolean;
  packageId: string;
  status: string;
  pickupOtp?: string | null;
}

export interface PackageNotifyCommand {
  societyId: string;
  packageId: string;
  notifiedAt: Date;
}

export interface PackageCollectCommand {
  societyId: string;
  packageId: string;
  providedOtp: string;
  collectedBy: string;
  collectedAt: Date;
}

export interface PackageTransitionCommand {
  societyId: string;
  packageId: string;
  action: "return" | "mark_lost";
}

export interface PackageMutationResult {
  packageId: string;
  status: string;
}

@Injectable()
export class PackageRepository {
  constructor(
    private readonly client: PackagePersistenceClient = prisma as unknown as PackagePersistenceClient,
    private readonly otpFactory: () => string = () => generatePickupOtp(),
  ) {}

  async intakePackage(command: PackageIntakeCommand): Promise<PackageIntakeResult> {
    const plan = planPackageIntake(command);

    const existing = await this.client.package.findFirst({
      where: {
        societyId: plan.societyId,
        flatId: plan.flatId,
        receivedAt: command.receivedAt,
        ...(plan.courierName ? { courierName: plan.courierName } : {}),
      },
    });

    if (existing) {
      return {
        logged: true,
        replayed: true,
        packageId: existing.id,
        status: existing.status,
        pickupOtp: existing.pickupOtp ?? null,
      };
    }

    const pickupOtp = this.otpFactory();
    const created = await this.client.package.create({
      data: {
        societyId: plan.societyId,
        flatId: plan.flatId,
        courierName: plan.courierName ?? null,
        description: plan.description ?? null,
        photoUrl: command.photoUrl ?? null,
        loggedBy: plan.loggedBy,
        status: plan.status,
        receivedAt: command.receivedAt,
        pickupOtp,
      },
    });

    return { logged: true, replayed: false, packageId: created.id, status: created.status, pickupOtp };
  }

  async notifyPackage(command: PackageNotifyCommand): Promise<PackageMutationResult> {
    const record = await this.requirePackage(command.societyId, command.packageId);
    const { status } = applyPackageTransition({
      current: record.status as PackageStatus,
      action: "notify",
    });

    const updated = await this.client.package.update({
      where: { id: command.packageId },
      data: { status, notifiedAt: command.notifiedAt },
    });

    return { packageId: updated.id, status: updated.status };
  }

  async collectPackage(command: PackageCollectCommand): Promise<PackageMutationResult> {
    const record = await this.requirePackage(command.societyId, command.packageId);
    verifyPackagePickup({ expectedOtp: record.pickupOtp, providedOtp: command.providedOtp });
    const { status } = applyPackageTransition({
      current: record.status as PackageStatus,
      action: "collect",
    });

    const updated = await this.client.package.update({
      where: { id: command.packageId },
      data: {
        status,
        collectedBy: command.collectedBy,
        collectedAt: command.collectedAt,
      },
    });

    return { packageId: updated.id, status: updated.status };
  }

  async transitionPackage(command: PackageTransitionCommand): Promise<PackageMutationResult> {
    const record = await this.requirePackage(command.societyId, command.packageId);
    const { status } = applyPackageTransition({
      current: record.status as PackageStatus,
      action: command.action,
    });

    const updated = await this.client.package.update({
      where: { id: command.packageId },
      data: { status },
    });

    return { packageId: updated.id, status: updated.status };
  }

  async listPackages(societyId: string, status?: string): Promise<PackageRecord[]> {
    return this.client.package.findMany({
      where: { societyId, ...(status ? { status } : {}) },
      orderBy: { receivedAt: "desc" },
    });
  }

  private async requirePackage(societyId: string, packageId: string): Promise<PackageRecord> {
    const record = await this.client.package.findUnique({ where: { id: packageId } });

    if (!record || record.societyId !== societyId) {
      throw new Error(`Package ${packageId} does not exist in society ${societyId}.`);
    }

    return record;
  }
}
