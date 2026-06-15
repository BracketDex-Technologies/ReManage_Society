import { describe, expect, it } from "vitest";
import { validateSocietyImportRows } from "@society/society-core";
import {
  SocietyCoreRepository,
  type SocietyCorePersistenceClient,
} from "../../apps/api/src/society-core/society-core.repository.ts";

function createClient(): SocietyCorePersistenceClient & { operations: string[] } {
  const operations: string[] = [];
  const client: SocietyCorePersistenceClient & { operations: string[] } = {
    operations,
    $transaction: async <T>(callback: (tx: typeof client) => Promise<T>) => callback(client),
    society: { upsert: async () => ({ id: "society_a" }) },
    unit: {
      upsert: async () => ({ id: "unit_1", societyId: "society_a", flatNumber: "A-101", legacyFlatId: null }),
      findUnique: async () => null,
      update: async () => ({ id: "unit_1" }),
      findMany: async () => [],
    },
    person: {
      findFirst: async () => null,
      create: async () => {
        operations.push("person.create");
        return { id: "person_1", name: "Ravi" };
      },
    },
    unitOccupancy: {
      findFirst: async () => null,
      create: async () => {
        operations.push("occupancy.create");
        return { id: "occ_1" };
      },
      updateMany: async () => ({ count: 0 }),
    },
    moveEvent: { create: async () => ({ id: "move_1" }) },
    user: {
      findFirst: async () => null,
      create: async () => ({ id: "user_1", email: "ravi@example.com", name: "Ravi" }),
    },
  };
  return client;
}

describe("society critical contract", () => {
  it("rejects invalid import rows in dry-run validation", () => {
    const result = validateSocietyImportRows([
      { rowNumber: 1, unitNumber: "", personName: "Ravi", phone: "9000000001", relationshipType: "OWNER" },
    ]);
    expect(result.accepted).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("does not commit import rows when validation fails", async () => {
    const client = createClient();
    const repo = new SocietyCoreRepository(client);
    const result = await repo.commitImportRows("society_a", [
      { rowNumber: 1, unitNumber: "", personName: "Bad Row", phone: "9000000001", relationshipType: "OWNER" },
    ]);
    expect(result.committedRows).toBe(0);
    expect(client.operations).toEqual([]);
  });
});
