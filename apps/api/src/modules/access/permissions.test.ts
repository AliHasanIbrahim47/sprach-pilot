import { can, type Permission, type UserRole } from "@sprachpilot/shared";
import { describe, expect, it } from "vitest";

const matrix: readonly (readonly [UserRole, Permission, boolean])[] = [
  ["learner", "learn", true],
  ["learner", "tandem.offer", false],
  ["learner", "events.manage", false],
  ["learner", "scenarios.author", false],
  ["learner", "moderation.act", false],
  ["learner", "roles.assign", false],
  ["volunteer", "learn", true],
  ["volunteer", "tandem.offer", true],
  ["volunteer", "events.manage", false],
  ["volunteer", "scenarios.author", false],
  ["volunteer", "moderation.act", false],
  ["volunteer", "roles.assign", false],
  ["organizer", "learn", true],
  ["organizer", "tandem.offer", false],
  ["organizer", "events.manage", true],
  ["organizer", "scenarios.author", false],
  ["organizer", "moderation.act", false],
  ["organizer", "roles.assign", false],
  ["content_editor", "learn", true],
  ["content_editor", "tandem.offer", false],
  ["content_editor", "events.manage", false],
  ["content_editor", "scenarios.author", true],
  ["content_editor", "moderation.act", false],
  ["content_editor", "roles.assign", false],
  ["moderator", "learn", true],
  ["moderator", "tandem.offer", false],
  ["moderator", "events.manage", false],
  ["moderator", "scenarios.author", false],
  ["moderator", "moderation.act", true],
  ["moderator", "roles.assign", false],
  ["admin", "learn", true],
  ["admin", "tandem.offer", true],
  ["admin", "events.manage", true],
  ["admin", "scenarios.author", true],
  ["admin", "moderation.act", true],
  ["admin", "roles.assign", true],
];

describe("can(role, permission)", () => {
  it.each(matrix)("%s %s → %s", (role, permission, allowed) => {
    expect(can(role, permission)).toBe(allowed);
  });

  it("grants nothing to an unknown role", () => {
    expect(can("tutor", "learn")).toBe(false);
  });
});
