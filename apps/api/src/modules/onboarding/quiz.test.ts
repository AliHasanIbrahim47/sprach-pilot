import { describe, expect, it } from "vitest";

import { QUIZ_ITEMS } from "./quiz.js";

describe("placement quiz content", () => {
  it("ships 10 A2 items, and every listening item has a transcript", () => {
    expect(QUIZ_ITEMS).toHaveLength(10);
    expect(QUIZ_ITEMS.every((item) => item.level === "A2")).toBe(true);
    expect(QUIZ_ITEMS.some((item) => item.kind === "reading" && item.passage)).toBe(true);

    const listening = QUIZ_ITEMS.filter((item) => item.kind === "listening");
    expect(listening.length).toBeGreaterThan(0);
    expect(listening.every((item) => item.transcript && item.transcript.length > 0)).toBe(true);
    expect(new Set(QUIZ_ITEMS.map((item) => item.correctChoiceId)).size).toBeGreaterThan(1);
  });
});
