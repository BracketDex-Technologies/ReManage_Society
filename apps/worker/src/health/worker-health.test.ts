import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkerHealthSnapshot, parseWorkerRuntimeConfig } from "./worker-health.js";

test("parseWorkerRuntimeConfig uses env defaults for scaffold startup", () => {
  const config = parseWorkerRuntimeConfig({});

  assert.deepEqual(config, {
    concurrency: 5,
    port: 4010,
    queueConnection: {
      host: "localhost",
      port: 6379,
      url: "redis://localhost:6379",
    },
  });
});

test("buildWorkerHealthSnapshot reports queue placeholder connectivity state", () => {
  const config = parseWorkerRuntimeConfig({
    VALKEY_PORT: "6380",
    VALKEY_URL: "redis://cache.internal:6380",
    WORKER_CONCURRENCY: "12",
    WORKER_PORT: "4020",
  });

  const health = buildWorkerHealthSnapshot(config, {
    queueConnected: false,
  });

  assert.equal(health.service, "worker");
  assert.equal(health.status, "degraded");
  assert.equal(health.concurrency, 12);
  assert.equal(health.queue.name, "default");
  assert.equal(health.queue.status, "placeholder");
  assert.equal(health.queue.connection.host, "cache.internal");
  assert.equal(health.queue.connection.port, 6380);
  assert.match(health.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
