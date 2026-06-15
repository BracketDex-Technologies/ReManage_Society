import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  computeCoverageStatus,
  computeNextMaintenance,
  isMaintenanceDue,
  normalizeAssetCondition,
  normalizeVendorCategory,
} from "../../../../packages/operations-core/src/index.ts";

interface VendorRecord {
  id: string;
  societyId: string;
  name: string;
  amcEndDate?: Date | null;
}

interface AssetRecord {
  id: string;
  societyId: string;
  name: string;
  warrantyEnd?: Date | null;
  nextMaintenanceAt?: Date | null;
  maintenanceCycle?: number | null;
}

export interface AssetPersistenceClient {
  vendor: {
    create(input: { data: Record<string, unknown> }): Promise<VendorRecord>;
    findMany(input: Record<string, unknown>): Promise<VendorRecord[]>;
  };
  societyAsset: {
    findUnique(input: { where: { id: string } }): Promise<AssetRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<AssetRecord>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<AssetRecord>;
    findMany(input: Record<string, unknown>): Promise<AssetRecord[]>;
  };
}

export interface CreateVendorCommand {
  societyId: string;
  name: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  hasAMC?: boolean;
  amcStartDate?: Date;
  amcEndDate?: Date;
  amcAmount?: number;
}

export interface CreateAssetCommand {
  societyId: string;
  name: string;
  category: string;
  location?: string;
  purchaseDate?: Date;
  purchaseAmount?: number;
  warrantyEnd?: Date;
  condition?: string;
  lastMaintenanceAt?: Date;
  maintenanceCycle?: number;
}

export interface RecordMaintenanceCommand {
  societyId: string;
  assetId: string;
  performedAt: Date;
  maintenanceCycle?: number;
  condition?: string;
}

@Injectable()
export class AssetRepository {
  constructor(
    private readonly client: AssetPersistenceClient = prisma as unknown as AssetPersistenceClient,
  ) {}

  async createVendor(command: CreateVendorCommand): Promise<{ created: true; vendorId: string }> {
    const category = normalizeVendorCategory(command.category);

    const vendor = await this.client.vendor.create({
      data: {
        societyId: command.societyId,
        name: command.name,
        category,
        contactPerson: command.contactPerson ?? null,
        phone: command.phone ?? null,
        email: command.email ?? null,
        gstNumber: command.gstNumber ?? null,
        hasAMC: command.hasAMC ?? false,
        amcStartDate: command.amcStartDate ?? null,
        amcEndDate: command.amcEndDate ?? null,
        amcAmount: command.amcAmount ?? null,
      },
    });

    return { created: true, vendorId: vendor.id };
  }

  async listVendors(
    societyId: string,
    now: Date,
  ): Promise<Array<VendorRecord & { amcStatus: string }>> {
    const vendors = await this.client.vendor.findMany({
      where: { societyId },
      orderBy: { name: "asc" },
    });

    return vendors.map((vendor) => ({
      ...vendor,
      amcStatus: computeCoverageStatus({ endDate: vendor.amcEndDate ?? null, now }),
    }));
  }

  async createAsset(command: CreateAssetCommand): Promise<{ created: true; assetId: string }> {
    const condition = normalizeAssetCondition(command.condition);
    const nextMaintenanceAt =
      command.lastMaintenanceAt && command.maintenanceCycle
        ? computeNextMaintenance({
            lastMaintenanceAt: command.lastMaintenanceAt,
            maintenanceCycleDays: command.maintenanceCycle,
          })
        : null;

    const asset = await this.client.societyAsset.create({
      data: {
        societyId: command.societyId,
        name: command.name,
        category: command.category,
        location: command.location ?? null,
        purchaseDate: command.purchaseDate ?? null,
        purchaseAmount: command.purchaseAmount ?? null,
        warrantyEnd: command.warrantyEnd ?? null,
        condition,
        lastMaintenanceAt: command.lastMaintenanceAt ?? null,
        nextMaintenanceAt,
        maintenanceCycle: command.maintenanceCycle ?? null,
        isActive: true,
      },
    });

    return { created: true, assetId: asset.id };
  }

  async recordMaintenance(
    command: RecordMaintenanceCommand,
  ): Promise<{ recorded: true; assetId: string; nextMaintenanceAt: string | null }> {
    const asset = await this.requireAsset(command.societyId, command.assetId);
    const cycle = command.maintenanceCycle ?? asset.maintenanceCycle ?? null;
    const nextMaintenanceAt = cycle
      ? computeNextMaintenance({ lastMaintenanceAt: command.performedAt, maintenanceCycleDays: cycle })
      : null;

    const updated = await this.client.societyAsset.update({
      where: { id: command.assetId },
      data: {
        lastMaintenanceAt: command.performedAt,
        nextMaintenanceAt,
        ...(cycle ? { maintenanceCycle: cycle } : {}),
        ...(command.condition ? { condition: normalizeAssetCondition(command.condition) } : {}),
      },
    });

    return {
      recorded: true,
      assetId: updated.id,
      nextMaintenanceAt: nextMaintenanceAt ? nextMaintenanceAt.toISOString() : null,
    };
  }

  async listDueMaintenance(societyId: string, now: Date): Promise<AssetRecord[]> {
    const assets = await this.client.societyAsset.findMany({
      where: { societyId, isActive: true },
      orderBy: { nextMaintenanceAt: "asc" },
    });

    return assets.filter((asset) =>
      isMaintenanceDue({ nextMaintenanceAt: asset.nextMaintenanceAt ?? null, now }),
    );
  }

  private async requireAsset(societyId: string, assetId: string): Promise<AssetRecord> {
    const asset = await this.client.societyAsset.findUnique({ where: { id: assetId } });

    if (!asset || asset.societyId !== societyId) {
      throw new Error(`Asset ${assetId} does not exist in society ${societyId}.`);
    }

    return asset;
  }
}
