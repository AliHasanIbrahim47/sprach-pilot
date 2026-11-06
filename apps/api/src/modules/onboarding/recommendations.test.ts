import { describe, expect, it } from "vitest";

import { recommendScenarios } from "./recommendations.js";

describe("recommendScenarios", () => {
  it("includes a housing scenario when housing is a goal", () => {
    expect(
      recommendScenarios({ level: "A2", goals: ["housing"] }).map((scenario) => scenario.id),
    ).toEqual(["housing-viewing", "housing-lease", "bureaucracy-registration"]);
  });
});
