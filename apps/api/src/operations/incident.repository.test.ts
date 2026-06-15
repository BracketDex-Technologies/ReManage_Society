import { describe, expect, it } from "vitest";
import { IncidentRepository, type IncidentPersistenceClient } from "./incident.repository.ts";

function createClient(
  options: { existingSos?: boolean; existingBlacklist?: boolean } = {},
) {
  const log: string[] = [];
  const client: IncidentPersistenceClient & { log: string[] } = {
    log,
    gateIncident: {
      findFirst: async () =>
        options.existingSos
          ? { id: "incident_existing", societyId: "society_a", severity: "critical", status: "reported" }
          : null,
      create: async () => {
        log.push("incident.create");
        return { id: "incident_1", societyId: "society_a", severity: "critical", status: "reported" };
      },
      findMany: async () => [
        { id: "incident_1", societyId: "society_a", severity: "high", status: "reported" },
      ],
    },
    blacklist: {
      findFirst: async () =>
        options.existingBlacklist
          ? { id: "bl_existing", societyId: "society_a", name: "Bad Actor", phone: "9111111111" }
          : null,
      create: async () => {
        log.push("blacklist.create");
        return { id: "bl_1", societyId: "society_a", name: "Bad Actor", phone: "9111111111" };
      },
      findMany: async () => [
        { id: "bl_1", societyId: "society_a", name: "Bad Actor", phone: "9111111111" },
      ],
    },
  };

  return client;
}

describe("IncidentRepository", () => {
  it("reports a normalized incident", async () => {
    const repository = new IncidentRepository(createClient());

    await expect(
      repository.reportIncident({
        societyId: "society_a",
        guardId: "guard_1",
        type: "Theft",
        description: "Bag stolen",
        severity: "high",
      }),
    ).resolves.toEqual({ reported: true, incidentId: "incident_1", severity: "high" });
  });

  it("rejects an unsupported incident type", async () => {
    const repository = new IncidentRepository(createClient());

    await expect(
      repository.reportIncident({ societyId: "society_a", type: "zombie", description: "x" }),
    ).rejects.toThrow(/not supported/i);
  });

  it("raises an SOS with computed escalation", async () => {
    const repository = new IncidentRepository(createClient());

    const result = await repository.raiseSos({
      societyId: "society_a",
      reportedBy: "resident_1",
      raisedAt: new Date("2026-06-07T09:00:00.000Z"),
    });

    expect(result).toMatchObject({
      raised: true,
      replayed: false,
      incidentId: "incident_1",
      escalation: { severity: "critical", acknowledgementRequired: true },
    });
  });

  it("replays a duplicate SOS without creating a new incident", async () => {
    const client = createClient({ existingSos: true });
    const repository = new IncidentRepository(client);

    const result = await repository.raiseSos({
      societyId: "society_a",
      reportedBy: "resident_1",
      raisedAt: new Date("2026-06-07T09:00:00.000Z"),
    });

    expect(result).toMatchObject({ replayed: true, incidentId: "incident_existing" });
    expect(client.log).toEqual([]);
  });

  it("flags a blacklisted phone at the gate", async () => {
    const repository = new IncidentRepository(createClient());

    await expect(
      repository.checkBlacklist({ societyId: "society_a", phone: "9111111111" }),
    ).resolves.toMatchObject({ flagged: true, matches: [expect.objectContaining({ id: "bl_1" })] });
  });

  it("replays a duplicate blacklist entry by phone", async () => {
    const client = createClient({ existingBlacklist: true });
    const repository = new IncidentRepository(client);

    await expect(
      repository.addBlacklist({
        societyId: "society_a",
        name: "Bad Actor",
        phone: "9111111111",
        reason: "Theft",
        addedBy: "committee_1",
      }),
    ).resolves.toMatchObject({ replayed: true, blacklistId: "bl_existing" });
    expect(client.log).toEqual([]);
  });
});
