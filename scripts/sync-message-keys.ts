/**
 * Scans source for t("...") keys and adds missing entries to messages/*.json
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = join(root, "messages");

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      collectSourceFiles(full, acc);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function extractKeys(files: string[]): Set<string> {
  const keys = new Set<string>();
  const pattern = /\bt\(\s*["'`]([^"'`]+)["'`]/g;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const key = match[1].trim();
      if (key && !key.includes("${")) keys.add(key);
    }
  }
  return keys;
}

const srcDirs = [
  join(root, "src/app"),
  join(root, "src/components"),
  join(root, "src/lib"),
].flatMap((d) => collectSourceFiles(d));

const keys = extractKeys(srcDirs);
const authKeys = new Set(Object.keys(JSON.parse(readFileSync(join(messagesDir, "en.json"), "utf8")).auth));

for (const locale of ["en", "hi", "mr"] as const) {
  const path = join(messagesDir, `${locale}.json`);
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    common: Record<string, string>;
    auth: Record<string, string>;
  };

  for (const key of keys) {
    // Skip auth-namespace keys picked up from useTranslations("auth")
    if (authKeys.has(key)) continue;
    if (data.common[key] !== undefined) continue;
    data.common[key] = locale === "en" ? key : key;
  }

  writeFileSync(path, JSON.stringify(data, null, 2));
}

console.log(`Synced ${keys.size} unique t() keys into messages/*.json common namespace`);
