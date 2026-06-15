import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationsWorkerJob } from "./operations-worker.js";

test("buildOperationsWorkerJob creates deterministic retry-safe SOS escalation jobs", () => {
  assert.deepEqual(
    buildOperationsWorkerJob({
      societyId: "society_a",
      command: "sos-escalation",
      referenceId: "incident_1",
    }),
    {
      id: "operations:sos-escalation:society_a:incident_1",
      queue: "operations",
      name: "sos-escalation",
      attempts: 5,
      payload: {
        societyId: "society_a",
        command: "sos-escalation",
        referenceId: "incident_1",
      },
    },
  );
});

test("buildOperationsWorkerJob rejects missing identifiers", () => {
  assert.throws(
    () =>
      buildOperationsWorkerJob({
        societyId: "  ",
        command: "amc-expiry-reminder",
        referenceId: "vendor_1",
      }),
    /societyId and referenceId/,
  );
});
