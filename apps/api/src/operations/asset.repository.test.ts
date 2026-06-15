import { describe, expect, it } from "vitest";
import { AssetRepository, type AssetPersistenceClient } from "./asset.repository.ts";

function createClient() {
  const client: AssetPersistenceClient = {
    vendor: {
      create: async () => ({ id: "vendor_1", societyId: "society_a", name: "LiftCo", amcEndDate: null }),
      findMany: async () => [
        {
          id: "vendor_1",
          societyId: "society_a",
          name: "LiftCo",
          amcEndDate: new Date("2026-06-20T00:00:00.000Z"),
        },
      ],
    },
    societyAsset: {
      findUnique: async () => ({
        id: "asset_1",
        societyId: "society_a",
        name: "Generator",
        maintenanceCycle: 30,
        nextMaintenanceAt: new Date("2026-06-01T00:00:00.000Z"),
      }),
      create: async () => ({ id: "asset_1", societyId: "society_a", name: "Generator" }),
      update: async () => ({ id: "asset_1", societyId: "society_a", name: "Generator" }),
      findMany: async () => [
        {
          id: "asset_1",
          societyId: "society_a",
          name: "Generator",
          nextMaintenanceAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          id: "asset_2",
          societyId: "society_a",
          name: "Lift",
          nextMaintenanceAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    },
  };

  return client;
}

describe("AssetRepository", () => {
  it("creates a vendor with a normalized category", async () => {
    const repository = new AssetRepository(createClient());
    await expect(
      repository.createVendor({ societyId: "society_a", name: "LiftCo", category: "Lift" }),
    ).resolves.toEqual({ created: true, vendorId: "vendor_1" });
  });

  it("rejects an unsupported vendor category", async () => {
    const repository = new AssetRepository(createClient());
    await expect(
      repository.createVendor({ societyId: "society_a", name: "X", category: "astrology" }),
    ).rejects.toThrow(/not supported/i);
  });

  it("computes AMC status when listing vendors", async () => {
    const repository = new AssetRepository(createClient());
    const vendors = await repository.listVendors("society_a", new Date("2026-06-07T00:00:00.000Z"));
    expect(vendors[0]).toMatchObject({ amcStatus: "expiring_soon" });
  });

  it("records maintenance and computes the next maintenance date", async () => {
    const repository = new AssetRepository(createClient());
    await expect(
      repository.recordMaintenance({
        societyId: "society_a",
        assetId: "asset_1",
        performedAt: new Date("2026-06-07T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      recorded: true,
      assetId: "asset_1",
      nextMaintenanceAt: "2026-07-07T00:00:00.000Z",
    });
  });

  it("lists only assets that are due for maintenance", async () => {
    const repository = new AssetRepository(createClient());
    const due = await repository.listDueMaintenance("society_a", new Date("2026-07-02T00:00:00.000Z"));
    expect(due.map((asset) => asset.id)).toEqual(["asset_1"]);
  });

  it("rejects maintenance on an asset in another society", async () => {
    const repository = new AssetRepository(createClient());
    await expect(
      repository.recordMaintenance({
        societyId: "society_b",
        assetId: "asset_1",
        performedAt: new Date(),
      }),
    ).rejects.toThrow(/society/i);
  });
});
