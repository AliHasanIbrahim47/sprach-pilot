#!/usr/bin/env node
/**
 * Fail if any locale is missing keys that exist in `en.json` (SP-010 FR-4).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = join(root, "messages");
const sourceLocale = "en";

function flatten(value, prefix = "", out = new Map()) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      flatten(nested, path, out);
    }
    return out;
  }
  out.set(prefix, value);
  return out;
}

const files = readdirSync(messagesDir).filter((name) => name.endsWith(".json"));
const sourcePath = join(messagesDir, `${sourceLocale}.json`);
const sourceKeys = flatten(JSON.parse(readFileSync(sourcePath, "utf8")));

let hasError = false;

for (const file of files) {
  const locale = file.replace(/\.json$/, "");
  if (locale === sourceLocale) continue;

  const targetKeys = flatten(JSON.parse(readFileSync(join(messagesDir, file), "utf8")));
  const missing = [...sourceKeys.keys()].filter((key) => !targetKeys.has(key));
  const extra = [...targetKeys.keys()].filter((key) => !sourceKeys.has(key));

  if (missing.length > 0) {
    hasError = true;
    console.error(`[i18n] ${locale} missing ${missing.length} key(s) from ${sourceLocale}:`);
    for (const key of missing) console.error(`  - ${key}`);
  }

  if (extra.length > 0) {
    hasError = true;
    console.error(`[i18n] ${locale} has ${extra.length} extra key(s) not in ${sourceLocale}:`);
    for (const key of extra) console.error(`  - ${key}`);
  }

  if (missing.length === 0 && extra.length === 0) {
    console.info(`[i18n] ${locale}: ok (${sourceKeys.size} keys)`);
  }
}

if (hasError) {
  process.exit(1);
}

console.info("[i18n] all locales match en keys");
