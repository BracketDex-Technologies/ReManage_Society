import { describe, expect, it } from "vitest";
import {
  SocietyCoreRepository,
  type SocietyCorePersistenceClient,
} from "./society-core.repository.ts";

interface RepositoryOperation {
  model: string;
  action: string;
  input: unknown;
}

type RepositoryTestClient = SocietyCorePersistenceClient & {
  operations: RepositoryOperation[];
};

function createRepositoryClient() {
  const operations: RepositoryOperation[] = [];
  const client: RepositoryTestClient = {
    operations,
    $transaction: async <T>(callback: (transaction: typeof client) => Promise<T>) => callback(client),
    society: {
      upsert: async (input: unknown) => {
        operations.push({ model: "society", action: "upsert", input });
        return { id: "society_a" };
      },
    },
    unit: {
      upsert: async (input: unknown) => {
        operations.push({ model: "unit", action: "upsert", input });
        return {
          id: "unit_101",
          societyId: "society_a",
          flatNumber: "A-101",
          legacyFlatId: "flat_101",
        };
      },
      findUnique: async () => ({
        id: "unit_101",
        societyId: "society_a",
        flatNumber: "A-101",
        legacyFlatId: "flat_101",
      }),
      update: async (input: unknown) => {
        operations.push({ model: "unit", action: "update", input });
        return { id: "unit_101" };
      },
      findMany: async () => [
        {
          id: "unit_101",
          flatNumber: "A-101",
          occupancies: [
            {
              relationshipType: "OWNER",
              person: {
                id: "person_neha",
                name: "Neha Rao",
                phone: "9876543210",
                users: [
                  {
                    showPhoneInDirectory: false,
                    showEmailInDirectory: false,
                    email: "neha@example.com",
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    person: {
      findFirst: async () => null,
      create: async (input: unknown) => {
        operations.push({ model: "person", action: "create", input });
        return { id: "person_neha", name: "Neha Rao" };
      },
    },
    unitOccupancy: {
      findFirst: async () => null,
      create: async (input: unknown) => {
        operations.push({ model: "unitOccupancy", action: "create", input });
        return { id: "occupancy_1" };
      },
      updateMany: async (input: unknown) => {
        operations.push({ model: "unitOccupancy", action: "updateMany", input });
        return { count: 1 };
      },
    },
    moveEvent: {
      create: async (input: unknown) => {
        operations.push({ model: "moveEvent", action: "create", input });
        return { id: "move_1" };
      },
    },
    user: {
      findFirst: async () => null,
      create: async (input: unknown) => {
        operations.push({ model: "user", action: "create", input });
        return { id: "user_neha", email: "neha@example.com" };
      },
    },
  };

  return client;
}

describe("SocietyCoreRepository", () => {
  it("persists a society setup plan into society and unit records", async () => {
    const client = createRepositoryClient();
    const repository = new SocietyCoreRepository(client);

    const result = await repository.commitSetupPlan({
      societyId: "society_a",
      societyName: "Palm Heights",
      address: "MG Road",
      city: "Pune",
      pincode: "411001",
      buildings: [
        {
          name: "Tower A",
          wings: [
            {
              name: "A",
              floors: [
                {
                  number: 1,
                  units: [{ unitNumber: "A-101", unitType: "2BHK" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      societyId: "society_a",
      unitsConfigured: 1,
      ready: true,
    });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toEqual([
      "society.upsert",
      "unit.upsert",
    ]);
  });

  it("commits valid import rows into people and active occupancies", async () => {
    const client = createRepositoryClient();
    const repository = new SocietyCoreRepository(client);

    const result = await repository.commitImportRows("society_a", [
      {
        rowNumber: 2,
        unitNumber: "A-101",
        personName: "Neha Rao",
        phone: "9876543210",
        email: "neha@example.com",
        relationshipType: "OWNER",
      },
    ]);

    expect(result).toEqual({
      acceptedRows: 1,
      committedRows: 1,
      errors: [],
    });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toEqual([
      "person.create",
      "unitOccupancy.create",
    ]);
  });

  it("does not write invalid import rows", async () => {
    const client = createRepositoryClient();
    const repository = new SocietyCoreRepository(client);

    const result = await repository.commitImportRows("society_a", [
      {
        rowNumber: 2,
        unitNumber: "",
        personName: "",
        relationshipType: "FRIEND",
      },
    ]);

    expect(result.committedRows).toBe(0);
    expect(result.errors).toHaveLength(3);
    expect(client.operations).toEqual([]);
  });

  it("persists occupancy move-out with unit status and move event", async () => {
    const client = createRepositoryClient();
    const repository = new SocietyCoreRepository(client);

    const result = await repository.commitOccupancyMove({
      societyId: "society_a",
      unitId: "unit_101",
      personId: "person_neha",
      relationshipType: "TENANT",
      moveType: "MOVE_OUT",
      effectiveDate: new Date("2026-06-07T00:00:00.000Z"),
      actorId: "committee_1",
    });

    expect(result).toEqual({
      societyId: "society_a",
      unitId: "unit_101",
      occupancyStatus: "MOVED_OUT",
      unitOccupancyStatus: "VACANT",
      moveEventRecorded: true,
    });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toEqual([
      "unitOccupancy.updateMany",
      "unit.update",
      "moveEvent.create",
    ]);
  });

  it("issues a local credential account for a person with email", async () => {
    const client = createRepositoryClient();
    const repository = new SocietyCoreRepository(client);

    const result = await repository.issueCredential({
      societyId: "society_a",
      personId: "person_neha",
      name: "Neha Rao",
      email: "neha@example.com",
      phone: "9876543210",
      role: "member",
    });

    expect(result).toEqual({
      issued: true,
      reason: "Credential account created",
      userId: "user_neha",
    });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toEqual([
      "user.create",
    ]);
  });

  it("reads a privacy-filtered directory from stored people and occupancies", async () => {
    const client = createRepositoryClient();
    const repository = new SocietyCoreRepository(client);

    const directory = await repository.readDirectory("society_a", { role: "resident" });

    expect(directory).toEqual([
      {
        unitNumber: "A-101",
        personName: "Neha Rao",
        relationshipType: "OWNER",
      },
    ]);
  });
});
