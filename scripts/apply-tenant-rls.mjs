import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const migrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260609120000_tenant_rls",
  "migration.sql",
);

const sql = readFileSync(migrationPath, "utf8");
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DIRECT_URL or DATABASE_URL is required to apply tenant RLS policies.");
  process.exit(1);
}

console.log("Applying tenant RLS migration SQL...");
const result = spawnSync("npx", ["prisma", "db", "execute", "--stdin"], {
  input: sql,
  encoding: "utf8",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

console.log("Tenant RLS policies applied. Set TENANT_RLS_ENABLED=true to enforce per-request tenant sessions.");
process.exit(0);
