import { spawnSync } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const shell = isWindows;
const steps = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "test:contract"]],
  ["npm", ["run", "test:integration"]],
  ["npm", ["run", "test:failure"]],
  ["npm", ["run", "db:validate"]],
  ["npm", ["run", "build"]],
];

for (const [cmd, args] of steps) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPhase 8 RC verification core gates passed.");
process.exit(0);
