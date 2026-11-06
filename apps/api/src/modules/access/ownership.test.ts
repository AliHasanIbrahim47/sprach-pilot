import { ForbiddenError } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

import { assertMayModifyOwnedResource } from "./ownership.js";

const ownerId = "owner-1";
const otherId = "actor-2";

describe("owned resource", () => {
  it("forbids a non-owner whose role lacks the cross-user permission", () => {
    expect(() =>
      assertMayModifyOwnedResource({
        actorId: otherId,
        ownerId,
        actorRole: "organizer",
        crossUserPermission: "roles.assign",
      }),
    ).toThrow(ForbiddenError);
  });

  it("allows the owner without the cross-user permission", () => {
    expect(() =>
      assertMayModifyOwnedResource({
        actorId: ownerId,
        ownerId,
        actorRole: "learner",
        crossUserPermission: "roles.assign",
      }),
    ).not.toThrow();
  });

  it("allows a non-owner who holds the cross-user permission", () => {
    expect(() =>
      assertMayModifyOwnedResource({
        actorId: otherId,
        ownerId,
        actorRole: "admin",
        crossUserPermission: "roles.assign",
      }),
    ).not.toThrow();
  });
});
