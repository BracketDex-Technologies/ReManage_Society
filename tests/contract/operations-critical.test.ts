import { describe, expect, it } from "vitest";
import { visitorLogDedupeKey } from "@society/operations-core";
import { PackageRepository, type PackagePersistenceClient } from "../../apps/api/src/operations/package.repository.ts";
import { IncidentRepository, type IncidentPersistenceClient } from "../../apps/api/src/operations/incident.repository.ts";

describe("operations critical contract", () => {
  it("builds deterministic visitor log dedupe keys", () => {
    const key = visitorLogDedupeKey({
      societyId: "society_a",
      flatNumber: "A-101",
      visitorName: "Ravi",
      arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
    });
    expect(key).toContain("society_a");
    expect(key).toContain("A-101");
  });

  it("replays package intake without duplicate create", async () => {
    const operations: string[] = [];
    const client: PackagePersistenceClient = {
      package: {
        findFirst: async () => ({
          id: "pkg_existing",
          societyId: "society_a",
          flatId: "flat_1",
          status: "received",
          pickupOtp: "123456",
        }),
        findUnique: async () => null,
        create: async () => {
          operations.push("create");
          return { id: "pkg_1", societyId: "society_a", flatId: "flat_1", status: "received", pickupOtp: "111111" };
        },
        update: async () => ({ id: "pkg_1", societyId: "society_a", flatId: "flat_1", status: "received", pickupOtp: "111111" }),
        findMany: async () => [],
      },
    };
    const repo = new PackageRepository(client, () => "111111");
    const result = await repo.intakePackage({
      societyId: "society_a",
      flatId: "flat_1",
      courierName: "Amazon",
      loggedBy: "guard_1",
      receivedAt: new Date("2026-06-07T11:00:00.000Z"),
    });
    expect(result.replayed).toBe(true);
    expect(operations).toEqual([]);
  });

  it("replays SOS raise idempotently", async () => {
    const operations: string[] = [];
    const client: IncidentPersistenceClient = {
      gateIncident: {
        findFirst: async () => ({ id: "sos_existing", societyId: "society_a", severity: "critical", status: "open" }),
        create: async () => {
          operations.push("create");
          return { id: "sos_1", societyId: "society_a", severity: "critical", status: "open" };
        },
        findMany: async () => [],
      },
      blacklist: {
        findFirst: async () => null,
        create: async () => ({ id: "bl_1", societyId: "society_a", name: "Blocked" }),
        findMany: async () => [],
      },
    };
    const repo = new IncidentRepository(client);
    const result = await repo.raiseSos({
      societyId: "society_a",
      reportedBy: "resident_1",
      severity: "critical",
      raisedAt: new Date("2026-06-07T12:00:00.000Z"),
    });
    expect(result.replayed).toBe(true);
    expect(operations).toEqual([]);
  });
});
