import type { PlacementLevel } from "@sprachpilot/shared";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

/** A band counts as passed at 7 of 10, matching the placement acceptance example. */
const PASS_RATIO = 0.7;

export interface PlacementAnswer {
  level: PlacementLevel;
  correct: boolean;
}

/**
 * Suggests the highest CEFR band where at least 70% of that band's items are correct.
 * A learner who passes nothing is placed at A1.
 */
export function suggestCefrLevel(answers: readonly PlacementAnswer[]): PlacementLevel {
  let suggested: PlacementLevel = "A1";

  for (const level of LEVELS) {
    const band = answers.filter((answer) => answer.level === level);
    if (band.length === 0) continue;
    const correct = band.filter((answer) => answer.correct).length;
    if (correct / band.length >= PASS_RATIO) suggested = level;
  }

  return suggested;
}
