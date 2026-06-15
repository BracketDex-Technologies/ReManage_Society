import { describe, expect, it } from "vitest";
import { HelpdeskRepository, type ComplaintPersistenceClient } from "./helpdesk.repository.ts";

type ComplaintRow = Awaited<ReturnType<ComplaintPersistenceClient["complaint"]["findFirst"]>>;

function createClient(existing?: Partial<NonNullable<ComplaintRow>>) {
  const log: Array<{ op: string; data?: Record<string, unknown> }> = [];
  const base = {
    id: "complaint_1",
    societyId: "society_a",
    flatNumber: "A-101",
    raisedBy: "resident_1",
    title: "Leak",
    description: "Water leak",
    category: "plumbing",
    status: "open",
    priority: "high",
    resolution: null,
    resolvedAt: null,
    assignedTo: null,
    assignedAt: null,
    slaHours: 24,
    escalationLevel: 0,
    escalatedAt: null,
    mediaUrls: null,
    satisfactionRating: null,
    satisfactionComment: null,
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
  };
  const record = existing ? { ...base, ...existing } : null;

  const client: ComplaintPersistenceClient & { log: typeof log } = {
    log,
    complaint: {
      create: async (input) => {
        log.push({ op: "create", data: input.data });
        return { ...base, ...(input.data as Record<string, unknown>) } as never;
      },
      findFirst: async () => record as never,
      findMany: async () => [base] as never,
      update: async (input) => {
        log.push({ op: "update", data: input.data });
        return { ...base, ...(record ?? {}), ...(input.data as Record<string, unknown>) } as never;
      },
    },
  };

  return client;
}

describe("HelpdeskRepository", () => {
  it("raises a complaint with default SLA and computed due date", async () => {
    const client = createClient();
    const repository = new HelpdeskRepository(client);

    const result = await repository.raiseComplaint({
      societyId: "society_a",
      flatNumber: "A-101",
      raisedBy: "resident_1",
      title: "Leak",
      description: "Water leak",
      category: "Plumbing",
      priority: "urgent",
      createdAt: new Date("2026-06-07T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      created: true,
      status: "open",
      priority: "urgent",
      category: "plumbing",
      slaDueAt: "2026-06-07T04:00:00.000Z",
    });
  });

  it("assigns and moves an open complaint to in_progress", async () => {
    const client = createClient({ status: "open" });
    const repository = new HelpdeskRepository(client);

    await expect(
      repository.assignComplaint({
        societyId: "society_a",
        complaintId: "complaint_1",
        assignedTo: "vendor_1",
      }),
    ).resolves.toMatchObject({ assigned: true });
    expect(client.log.at(-1)?.data).toMatchObject({ status: "in_progress", assignedTo: "vendor_1" });
  });

  it("resolves a complaint and records resolvedAt", async () => {
    const client = createClient({ status: "in_progress" });
    const repository = new HelpdeskRepository(client);

    const result = await repository.transitionComplaint({
      societyId: "society_a",
      complaintId: "complaint_1",
      action: "resolve",
      resolution: "Fixed",
      at: new Date("2026-06-07T03:00:00.000Z"),
    });

    expect(result).toMatchObject({ status: "resolved" });
    expect(client.log.at(-1)?.data).toMatchObject({ status: "resolved", resolution: "Fixed" });
  });

  it("escalates to the next tier and caps at chairman", async () => {
    const client = createClient({ status: "open", escalationLevel: 1 });
    const repository = new HelpdeskRepository(client);

    await expect(
      repository.escalateComplaint({ societyId: "society_a", complaintId: "complaint_1" }),
    ).resolves.toMatchObject({ escalationLevel: 2, target: "chairman" });
  });

  it("rejects rating a complaint that is not resolved or closed", async () => {
    const repository = new HelpdeskRepository(createClient({ status: "open" }));

    await expect(
      repository.rateComplaint({ societyId: "society_a", complaintId: "complaint_1", rating: 5 }),
    ).rejects.toThrow(/resolved or closed/i);
  });

  it("flags SLA breach in listings for still-open complaints", async () => {
    const repository = new HelpdeskRepository(createClient());

    const result = await repository.listComplaints("society_a", {
      now: new Date("2026-06-09T00:00:00.000Z"),
    });

    expect(result[0]).toMatchObject({ slaBreached: true });
  });

  it("throws when the complaint is missing", async () => {
    const repository = new HelpdeskRepository(createClient());

    await expect(
      repository.assignComplaint({
        societyId: "society_a",
        complaintId: "missing",
        assignedTo: "x",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
