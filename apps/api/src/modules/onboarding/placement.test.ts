import { describe, expect, it } from "vitest";

import { suggestCefrLevel } from "./placement.js";

describe("suggestCefrLevel", () => {
  it("suggests A2 when 7 of 10 A2 items are correct", () => {
    const answers = [
      ...Array.from({ length: 7 }, () => ({ level: "A2" as const, correct: true })),
      ...Array.from({ length: 3 }, () => ({ level: "A2" as const, correct: false })),
    ];

    expect(suggestCefrLevel(answers)).toBe("A2");
  });

  it("stays at A1 when an A2 band is below 7 of 10", () => {
    const answers = [
      ...Array.from({ length: 6 }, () => ({ level: "A2" as const, correct: true })),
      ...Array.from({ length: 4 }, () => ({ level: "A2" as const, correct: false })),
    ];

    expect(suggestCefrLevel(answers)).toBe("A1");
  });

  it("suggests the highest band cleared at 70 percent", () => {
    expect(
      suggestCefrLevel([
        { level: "A1", correct: true },
        { level: "A1", correct: true },
        { level: "A2", correct: true },
        { level: "A2", correct: true },
        { level: "B1", correct: true },
        { level: "B1", correct: false },
        { level: "B2", correct: false },
        { level: "B2", correct: false },
      ]),
    ).toBe("A2");
  });
});
