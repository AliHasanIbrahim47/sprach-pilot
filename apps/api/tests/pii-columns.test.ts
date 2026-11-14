import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PII_COLUMNS } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import {
  assertPrivacyDomains,
  piiColumnsInSchema,
} from "../src/modules/privacy/privacy-registry.js";

const schemaPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/prisma/schema.prisma",
);

describe("privacy registry", () => {
  it("fails when a schema column marked @pii is missing from the manifest", () => {
    const found = piiColumnsInSchema(readFileSync(schemaPath, "utf8"));
    expect(found).toEqual([...PII_COLUMNS].sort());
  });

  it("fails when a personal-data domain is not registered", () => {
    expect(() => assertPrivacyDomains(["identity", "avatars", "recordings"])).toThrow(/tandem/);
    expect(() =>
      assertPrivacyDomains(["identity", "avatars", "recordings", "tandem"]),
    ).not.toThrow();
  });
});
