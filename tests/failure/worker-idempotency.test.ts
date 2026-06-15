import { describe, expect, it } from "vitest";
import { buildFinanceWorkerJob } from "../../apps/worker/src/finance-worker.ts";
import { buildOperationsWorkerJob } from "../../apps/worker/src/operations-worker.ts";

describe("worker idempotency envelopes", () => {
  it("builds deterministic finance reconciliation jobs", () => {
    const input = {
      societyId: "society_a",
      command: "reconcile-payments" as const,
      period: "2026-06",
    };
    expect(buildFinanceWorkerJob(input).id).toBe(buildFinanceWorkerJob(input).id);
  });

  it("builds deterministic operations SOS jobs", () => {
    const input = {
      societyId: "society_a",
      command: "sos-escalation" as const,
      referenceId: "inc_1",
    };
    expect(buildOperationsWorkerJob(input).id).toBe(buildOperationsWorkerJob(input).id);
  });
});
