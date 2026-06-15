import "dotenv/config";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const strict = process.argv.includes("--strict");

async function loadValidator() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const modulePath = path.join(scriptDir, "..", "packages", "config", "src", "production.ts");
  return import(pathToFileURL(modulePath).href);
}

const { validateProductionReadiness, MANUAL_PRODUCTION_CHECKLIST } = await loadValidator();
const result = validateProductionReadiness(process.env);

console.log("\n=== Society Connect Production Readiness ===\n");

if (result.blockers.length > 0) {
  console.log("BLOCKERS (must fix before 10/10):");
  for (const issue of result.blockers) {
    const tag = issue.manual ? "[MANUAL] " : "";
    console.log(`  - ${tag}${issue.key}: ${issue.message}`);
  }
  console.log("");
}

if (result.warnings.length > 0) {
  console.log("WARNINGS (recommended before launch):");
  for (const issue of result.warnings) {
    const tag = issue.manual ? "[MANUAL] " : "";
    console.log(`  - ${tag}${issue.key}: ${issue.message}`);
  }
  console.log("");
}

console.log("MANUAL OPERATOR CHECKLIST:");
for (const [index, step] of MANUAL_PRODUCTION_CHECKLIST.entries()) {
  console.log(`  ${index + 1}. ${step}`);
}

console.log("");
if (result.ready) {
  console.log("Automated env checks: PASS");
  process.exit(0);
}

console.log(`Automated env checks: FAIL (${result.blockers.length} blocker(s))`);
process.exit(strict ? 1 : 0);
