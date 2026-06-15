import { describe, expect, it } from "vitest";
import { DatabaseReadinessService } from "./database-readiness.service.ts";

describe("DatabaseReadinessService", () => {
  it("reports ok when the database ping succeeds", async () => {
    const service = new DatabaseReadinessService(
      {
        $queryRawUnsafe: async () => [{ ready: 1 }],
      },
      {
        databaseUrl: "postgresql://society:secret@localhost:5432/society_connect",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
      },
    );

    await expect(service.snapshot()).resolves.toMatchObject({
      service: "database",
      status: "ok",
      target: "postgresql://<credentials>@localhost:5432/society_connect",
      timestamp: "2026-06-06T00:00:00.000Z",
    });
  });

  it("reports degraded without leaking credentials when the database ping fails", async () => {
    const service = new DatabaseReadinessService(
      {
        $queryRawUnsafe: async () => {
          throw new Error("password authentication failed for user society");
        },
      },
      {
        databaseUrl: "postgresql://society:secret@localhost:5432/society_connect",
        now: () => new Date("2026-06-06T00:00:00.000Z"),
      },
    );

    const snapshot = await service.snapshot();

    expect(snapshot).toMatchObject({
      service: "database",
      status: "degraded",
      target: "postgresql://<credentials>@localhost:5432/society_connect",
      timestamp: "2026-06-06T00:00:00.000Z",
    });
    expect(JSON.stringify(snapshot)).not.toContain("secret");
  });
});
