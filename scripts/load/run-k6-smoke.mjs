import { spawnSync } from "node:child_process";
import process from "node:process";

const result = spawnSync(
  "k6",
  ["run", "scripts/load/k6-api-smoke.js"],
  { stdio: "inherit", shell: process.platform === "win32" },
);

if (result.error?.code === "ENOENT") {
  console.warn("k6 not installed; skip load test (install k6 for staging validation).");
  process.exit(0);
}

process.exit(result.status ?? 1);
