import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const baseUrl = (process.env.NEST_API_BASE_URL || process.env.API_BASE_URL || "http://localhost:4000")
  .replace(/\/$/, "");
const outputDir = path.join(process.cwd(), "packages", "sdk", "generated");
const specPath = path.join(outputDir, "openapi.json");

async function main() {
  const specUrl = `${baseUrl}/docs-json`;
  const response = await fetch(specUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec from ${specUrl} (${response.status})`);
  }

  const spec = await response.json();
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  console.log(`OpenAPI spec saved to ${specPath}`);
  console.log("Next: wire openapi-typescript or orval against packages/sdk/generated/openapi.json");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
