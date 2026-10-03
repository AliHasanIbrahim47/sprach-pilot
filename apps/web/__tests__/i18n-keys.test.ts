import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function flatten(
  value: unknown,
  prefix = "",
  out = new Map<string, unknown>(),
): Map<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.set(prefix, value);
  return out;
}

describe("message catalogs (FR-4)", () => {
  it("keeps every locale in sync with en keys", () => {
    const dir = join(process.cwd(), "messages");
    const en = flatten(JSON.parse(readFileSync(join(dir, "en.json"), "utf8")));
    const locales = readdirSync(dir)
      .filter((name) => name.endsWith(".json") && name !== "en.json")
      .map((name) => name.replace(/\.json$/, ""));

    expect(locales.length).toBeGreaterThan(0);

    for (const locale of locales) {
      const keys = flatten(JSON.parse(readFileSync(join(dir, `${locale}.json`), "utf8")));
      const missing = [...en.keys()].filter((key) => !keys.has(key));
      const extra = [...keys.keys()].filter((key) => !en.has(key));
      expect(missing, `${locale} missing keys`).toEqual([]);
      expect(extra, `${locale} extra keys`).toEqual([]);
    }
  });
});
