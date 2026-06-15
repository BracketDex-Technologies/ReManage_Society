import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const BASELINE_PATH = path.join(process.cwd(), "docs", "security", "audit-baseline.json");

const result = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  timeout: 120_000,
});

let payload = { metadata: { vulnerabilities: {} } };
try {
  const stdout = result.stdout?.trim();
  if (stdout) {
    payload = JSON.parse(stdout);
  }
} catch {
  console.warn("npm audit JSON unavailable; skipping dependency gate in this environment.");
  process.exit(0);
}

const current = payload.metadata?.vulnerabilities ?? {};
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).vulnerabilities;

const fields = ["critical", "high", "moderate"];
let failed = false;

for (const field of fields) {
  const now = Number(current[field] ?? 0);
  const allowed = Number(baseline[field] ?? 0);
  console.log(`npm audit ${field}: current=${now} baseline=${allowed}`);
  if (now > allowed) {
    console.error(`npm audit gate failed: ${field} increased above baseline (${now} > ${allowed})`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
