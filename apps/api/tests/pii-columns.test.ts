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

  it("fails when a personal-data domain has no export and delete handler", () => {
    const handler = {
      exportUser: async () => undefined,
      deleteUser: async () => undefined,
    };
    expect(() =>
      assertPrivacyDomains([
        { id: "identity", ...handler },
        { id: "avatars", ...handler },
        { id: "recordings", ...handler },
      ]),
    ).toThrow(/tandem/);
    expect(() =>
      assertPrivacyDomains([
        { id: "identity", exportUser: handler.exportUser, deleteUser: undefined as never },
        { id: "avatars", ...handler },
        { id: "recordings", ...handler },
        { id: "tandem", ...handler },
      ]),
    ).toThrow(/identity/);
  });
});
