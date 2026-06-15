import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "src", "app", "api");
const OUTPUT = path.join(ROOT, "docs", "api", "legacy-route-inventory.md");
const DISPOSITION_SOURCE = path.join(ROOT, "src", "lib", "api", "route-disposition.ts");

function listRouteFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listRouteFiles(fullPath));
      continue;
    }
    if (entry === "route.ts") {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function toApiPath(filePath) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^.*src\/app\/api/, "/api")
    .replace(/\/route\.ts$/, "");
}

function readDispositionMap() {
  const source = readFileSync(DISPOSITION_SOURCE, "utf8");
  const blocks = source.match(/\{ routePath:[^}]+\}/g) ?? [];
  const entries = blocks.map((block) => ({
    routePath: block.match(/routePath:\s*"([^"]+)"/)?.[1] ?? "",
    disposition: block.match(/disposition:\s*"([^"]+)"/)?.[1] ?? "deprecate-410",
    nestEquivalent: block.match(/nestEquivalent:\s*"([^"]+)"/)?.[1] ?? "",
  }));
  return entries
    .filter((entry) => entry.routePath)
    .sort((a, b) => b.routePath.length - a.routePath.length);
}

function resolveDisposition(apiPath, dispositions) {
  for (const entry of dispositions) {
    if (apiPath === entry.routePath || apiPath.startsWith(`${entry.routePath}/`)) {
      return entry;
    }
  }
  return {
    routePath: apiPath,
    disposition: "deprecate-410",
    nestEquivalent: "",
  };
}

const routeFiles = listRouteFiles(API_ROOT);
const dispositions = readDispositionMap();

const lines = [
  "# Legacy Next.js API Route Inventory",
  "",
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Total route files: **${routeFiles.length}**`,
  "",
  "| Legacy route | Disposition | NestJS equivalent | Source file |",
  "|---|---|---|---|",
];

for (const file of routeFiles) {
  const apiPath = toApiPath(file);
  const entry = resolveDisposition(apiPath, dispositions);
  const relFile = path.relative(ROOT, file).replace(/\\/g, "/");
  lines.push(
    `| \`${apiPath}\` | ${entry.disposition} | ${entry.nestEquivalent || "—"} | \`${relFile}\` |`,
  );
}

lines.push("");
lines.push("Regenerate:");
lines.push("");
lines.push("```powershell");
lines.push("node scripts/generate-api-inventory.mjs");
lines.push("```");
lines.push("");

mkdirSync(path.dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${OUTPUT} (${routeFiles.length} routes)`);
