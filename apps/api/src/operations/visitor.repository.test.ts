import { describe, expect, it } from "vitest";
import {
  VisitorRepository,
  type OperationsPersistenceClient,
} from "./visitor.repository.ts";

interface RepositoryOperation {
  model: string;
  action: string;
  input: unknown;
}

type RepositoryTestClient = OperationsPersistenceClient & {
  operations: RepositoryOperation[];
};

function createClient(
  options: { existingVisitor?: boolean; existingPatrol?: boolean; visitorStatus?: string } = {},
) {
  const operations: RepositoryOperation[] = [];
  const visitorStatus = options.visitorStatus ?? "pending_approval";
  const client: RepositoryTestClient = {
    operations,
    visitor: {
      findFirst: async () =>
        options.existingVisitor
          ? { id: "visitor_existing", societyId: "society_a", flatNumber: "A-101", status: visitorStatus }
          : null,
      findUnique: async () => ({
        id: "visitor_1",
        societyId: "society_a",
        flatNumber: "A-101",
        status: visitorStatus,
      }),
      create: async (input: unknown) => {
        operations.push({ model: "visitor", action: "create", input });
        return { id: "visitor_1", societyId: "society_a", flatNumber: "A-101", status: "pending_approval" };
      },
      update: async (input: unknown) => {
        operations.push({ model: "visitor", action: "update", input });
        const data = (input as { data: { status: string } }).data;
        return { id: "visitor_1", societyId: "society_a", flatNumber: "A-101", status: data.status };
      },
      findMany: async () => [
        { id: "visitor_1", societyId: "society_a", flatNumber: "A-101", status: visitorStatus },
      ],
    },
    guardPatrol: {
      findFirst: async () => (options.existingPatrol ? { id: "patrol_existing" } : null),
      create: async (input: unknown) => {
        operations.push({ model: "guardPatrol", action: "create", input });
        return { id: "patrol_1" };
      },
      findMany: async () => [{ id: "patrol_1" }],
    },
  };

  return client;
}

describe("VisitorRepository", () => {
  it("logs a walk-in visitor as pending approval", async () => {
    const client = createClient();
    const repository = new VisitorRepository(client);

    const result = await repository.logVisitor({
      societyId: "society_a",
      flatNumber: "A-101",
      visitorName: "Ravi",
      phone: "9999999999",
      purpose: "delivery",
      arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
      guardId: "guard_1",
    });

    expect(result).toMatchObject({ logged: true, replayed: false, visitorId: "visitor_1", status: "pending_approval" });
    expect(client.operations.map((operation) => `${operation.model}.${operation.action}`)).toEqual([
      "visitor.create",
    ]);
  });

  it("replays a duplicate visitor log without creating a duplicate row", async () => {
    const client = createClient({ existingVisitor: true });
    const repository = new VisitorRepository(client);

    const result = await repository.logVisitor({
      societyId: "society_a",
      flatNumber: "A-101",
      visitorName: "Ravi",
      phone: "9999999999",
      purpose: "delivery",
      arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
      guardId: "guard_1",
    });

    expect(result).toMatchObject({ logged: true, replayed: true, visitorId: "visitor_existing" });
    expect(client.operations).toEqual([]);
  });

  it("records a resident approval response", async () => {
    const client = createClient({ visitorStatus: "pending_approval" });
    const repository = new VisitorRepository(client);

    const result = await repository.respondToVisitor({
      societyId: "society_a",
      visitorId: "visitor_1",
      decision: "approve",
      respondedAt: new Date("2026-06-07T10:05:00.000Z"),
    });

    expect(result).toEqual({ visitorId: "visitor_1", status: "approved", action: "approve" });
  });

  it("rejects responding to a visitor in another society", async () => {
    const client = createClient();
    const repository = new VisitorRepository(client);

    await expect(
      repository.respondToVisitor({
        societyId: "society_b",
        visitorId: "visitor_1",
        decision: "approve",
        respondedAt: new Date(),
      }),
    ).rejects.toThrow(/society/i);
  });

  it("admits an approved visitor and stamps entry time", async () => {
    const client = createClient({ visitorStatus: "approved" });
    const repository = new VisitorRepository(client);

    const result = await repository.transitionVisitor({
      societyId: "society_a",
      visitorId: "visitor_1",
      action: "enter",
      at: new Date("2026-06-07T10:06:00.000Z"),
    });

    expect(result).toEqual({ visitorId: "visitor_1", status: "inside", action: "enter" });
    const update = client.operations.find((operation) => operation.action === "update");
    expect((update?.input as { data: Record<string, unknown> }).data).toMatchObject({
      status: "inside",
    });
  });

  it("rejects an illegal visitor transition", async () => {
    const client = createClient({ visitorStatus: "exited" });
    const repository = new VisitorRepository(client);

    await expect(
      repository.transitionVisitor({
        societyId: "society_a",
        visitorId: "visitor_1",
        action: "enter",
        at: new Date(),
      }),
    ).rejects.toThrow(/cannot transition/i);
  });

  it("records a patrol scan idempotently", async () => {
    const client = createClient();
    const repository = new VisitorRepository(client);

    const result = await repository.scanPatrol({
      societyId: "society_a",
      guardId: "guard_1",
      checkpoint: "Gate A",
      scannedAt: new Date("2026-06-07T02:00:00.000Z"),
    });

    expect(result).toMatchObject({ recorded: true, replayed: false, patrolId: "patrol_1" });
  });

  it("replays a duplicate patrol scan", async () => {
    const client = createClient({ existingPatrol: true });
    const repository = new VisitorRepository(client);

    const result = await repository.scanPatrol({
      societyId: "society_a",
      guardId: "guard_1",
      checkpoint: "Gate A",
      scannedAt: new Date("2026-06-07T02:00:00.000Z"),
    });

    expect(result).toMatchObject({ recorded: true, replayed: true, patrolId: "patrol_existing" });
    expect(client.operations).toEqual([]);
  });
});
