import { describe, expect, it } from "vitest";
import { DatabaseReadinessService } from "../../apps/api/src/database/database-readiness.service.ts";
import { buildWorkerHealthSnapshot, parseWorkerRuntimeConfig } from "../../apps/worker/src/health/worker-health.ts";

describe("failure readiness", () => {
  it("reports database degraded when ping fails", async () => {
    const service = new DatabaseReadinessService(
      {
        $queryRawUnsafe: async () => {
          throw new Error("connection refused");
        },
      },
      {
        databaseUrl: "postgresql://society:secret@localhost:5432/society_connect",
        now: () => new Date("2026-06-07T00:00:00.000Z"),
      },
    );

    const snapshot = await service.snapshot();
    expect(snapshot.status).toBe("degraded");
    expect(JSON.stringify(snapshot)).not.toContain("secret");
  });

  it("reports worker degraded without queue connection", () => {
    const config = parseWorkerRuntimeConfig({});
    const health = buildWorkerHealthSnapshot(config, { queueConnected: false });
    expect(health.status).toBe("degraded");
    expect(health.queue.status).toBe("placeholder");
  });
});
