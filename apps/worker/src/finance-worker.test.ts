import test from "node:test";
import assert from "node:assert/strict";
import { buildFinanceWorkerJob } from "./finance-worker.js";

test("buildFinanceWorkerJob creates deterministic retry-safe reconciliation jobs", () => {
  assert.deepEqual(
    buildFinanceWorkerJob({
      societyId: "society_a",
      command: "reconcile-payments",
      period: "2026-06",
    }),
    {
      id: "finance:reconcile-payments:society_a:2026-06",
      queue: "finance",
      name: "reconcile-payments",
      attempts: 5,
      payload: {
        societyId: "society_a",
        command: "reconcile-payments",
        period: "2026-06",
      },
    },
  );
});
