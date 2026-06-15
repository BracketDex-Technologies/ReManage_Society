import { describe, expect, it } from "vitest";
import { ParkingRepository, type ParkingPersistenceClient } from "./parking.repository.ts";

function createClient(
  options: { existingSlot?: boolean; existingAssignment?: boolean; slotAssigned?: boolean; slotStatus?: string } = {},
) {
  const log: string[] = [];
  const slot = {
    id: "slot_1",
    societyId: "society_a",
    status: options.slotStatus ?? "ACTIVE",
    isAssigned: options.slotAssigned ?? false,
  };
  const client: ParkingPersistenceClient & { log: string[] } = {
    log,
    parkingZone: {
      create: async () => ({ id: "zone_1" }),
      findMany: async () => [{ id: "zone_1" }],
    },
    parkingSlot: {
      findFirst: async () => (options.existingSlot ? { ...slot, id: "slot_existing" } : null),
      findUnique: async () => slot,
      create: async () => {
        log.push("slot.create");
        return slot;
      },
      update: async () => {
        log.push("slot.update");
        return slot;
      },
      findMany: async () => [
        { id: "slot_1", societyId: "society_a", status: "ACTIVE", isAssigned: false },
        { id: "slot_2", societyId: "society_a", status: "ACTIVE", isAssigned: true },
        { id: "slot_3", societyId: "society_a", status: "MAINTENANCE", isAssigned: false },
      ],
    },
    parkingAssignment: {
      findFirst: async () =>
        options.existingAssignment
          ? { id: "assign_existing", societyId: "society_a", slotId: "slot_1", status: "ACTIVE" }
          : null,
      create: async () => {
        log.push("assignment.create");
        return { id: "assign_1", societyId: "society_a", slotId: "slot_1", status: "ACTIVE" };
      },
      updateMany: async () => {
        log.push("assignment.updateMany");
        return { count: 1 };
      },
    },
  };

  return client;
}

describe("ParkingRepository", () => {
  it("creates a slot with a normalized type", async () => {
    const client = createClient();
    const repository = new ParkingRepository(client);

    await expect(
      repository.createSlot({ societyId: "society_a", slotNumber: "P-1", slotType: "ev" }),
    ).resolves.toMatchObject({ created: true, replayed: false, slotId: "slot_1" });
  });

  it("rejects an unsupported slot type", async () => {
    const repository = new ParkingRepository(createClient());
    await expect(
      repository.createSlot({ societyId: "society_a", slotNumber: "P-1", slotType: "helipad" }),
    ).rejects.toThrow(/not supported/i);
  });

  it("assigns an available slot", async () => {
    const client = createClient();
    const repository = new ParkingRepository(client);

    await expect(
      repository.assignSlot({
        societyId: "society_a",
        slotId: "slot_1",
        vehicleId: "vehicle_1",
        assignmentType: "owner",
      }),
    ).resolves.toMatchObject({ assigned: true, replayed: false, assignmentId: "assign_1" });
    expect(client.log).toContain("slot.update");
  });

  it("replays a duplicate assignment for the same vehicle", async () => {
    const repository = new ParkingRepository(createClient({ existingAssignment: true }));

    await expect(
      repository.assignSlot({
        societyId: "society_a",
        slotId: "slot_1",
        vehicleId: "vehicle_1",
      }),
    ).resolves.toMatchObject({ replayed: true, assignmentId: "assign_existing" });
  });

  it("rejects assigning an already-assigned slot", async () => {
    const repository = new ParkingRepository(createClient({ slotAssigned: true }));

    await expect(
      repository.assignSlot({ societyId: "society_a", slotId: "slot_1" }),
    ).rejects.toThrow(/already assigned/i);
  });

  it("summarizes capacity", async () => {
    const repository = new ParkingRepository(createClient());

    await expect(repository.capacity("society_a")).resolves.toEqual({
      total: 3,
      available: 1,
      assigned: 1,
      blocked: 1,
    });
  });

  it("rejects acting on a slot in another society", async () => {
    const repository = new ParkingRepository(createClient());

    await expect(
      repository.releaseSlot({ societyId: "society_b", slotId: "slot_1" }),
    ).rejects.toThrow(/society/i);
  });
});
