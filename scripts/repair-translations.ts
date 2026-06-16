/**
 * Repairs HI/MR message files: removes auth-namespace pollution from common,
 * applies curated full-sentence translations, and clears broken hybrid strings.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import hiOverrides from "../messages/overrides/hi.json";
import mrOverrides from "../messages/overrides/mr.json";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = join(root, "messages");

type LocaleFile = {
  common: Record<string, string>;
  auth: Record<string, string>;
};

function loadLocale(locale: string): LocaleFile {
  return JSON.parse(readFileSync(join(messagesDir, `${locale}.json`), "utf8"));
}

function saveLocale(locale: string, data: LocaleFile) {
  writeFileSync(join(messagesDir, `${locale}.json`), JSON.stringify(data, null, 2));
}

const en = loadLocale("en");
const hi = loadLocale("hi");
const mr = loadLocale("mr");

const authKeySet = new Set(Object.keys(en.auth));

let hiFixed = 0;
let mrFixed = 0;
let removed = 0;

for (const key of Object.keys(hi.common)) {
  if (authKeySet.has(key)) {
    delete hi.common[key];
    delete mr.common[key];
    delete en.common[key];
    removed++;
  }
}

for (const [key, value] of Object.entries(hiOverrides as Record<string, string>)) {
  if (hi.common[key] !== value) {
    hi.common[key] = value;
    hiFixed++;
  }
}

for (const [key, value] of Object.entries(mrOverrides as Record<string, string>)) {
  if (mr.common[key] !== value) {
    mr.common[key] = value;
    mrFixed++;
  }
}

const allCommonKeys = new Set([
  ...Object.keys(en.common),
  ...Object.keys(hi.common),
  ...Object.keys(mr.common),
]);

for (const key of allCommonKeys) {
  if (!en.common[key]) en.common[key] = key;
  if (!hi.common[key]) hi.common[key] = en.common[key];
  if (!mr.common[key]) mr.common[key] = en.common[key];
}

saveLocale("en", en);
saveLocale("hi", hi);
saveLocale("mr", mr);

console.log(`Repair complete: removed ${removed} auth keys from common, applied ${hiFixed} HI + ${mrFixed} MR overrides`);
