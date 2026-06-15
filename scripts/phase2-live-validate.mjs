import { spawnSync } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const command = isWindows ? "powershell" : "bash";
const args = isWindows
  ? ["-ExecutionPolicy", "Bypass", "-File", "scripts/phase2-live-validate.ps1"]
  : ["scripts/phase2-live-validate.sh"];

const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
