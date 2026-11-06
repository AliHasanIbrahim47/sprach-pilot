import type { LearningGoal, PlacementLevel, Scenario } from "@sprachpilot/shared";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "housing-viewing",
    level: "A2",
    goals: ["housing"],
    title: "Wohnungsbesichtigung",
  },
  {
    id: "housing-lease",
    level: "B1",
    goals: ["housing"],
    title: "Den Mietvertrag verstehen",
  },
  {
    id: "work-interview",
    level: "A2",
    goals: ["work"],
    title: "Vorstellungsgespräch",
  },
  {
    id: "bureaucracy-registration",
    level: "A2",
    goals: ["bureaucracy"],
    title: "Anmeldung im Bürgeramt",
  },
  {
    id: "health-appointment",
    level: "A2",
    goals: ["health"],
    title: "Einen Arzttermin vereinbaren",
  },
  {
    id: "social-cafe",
    level: "A1",
    goals: ["social"],
    title: "Im Café bestellen",
  },
  {
    id: "exam-goethe-b1",
    level: "B1",
    goals: ["exam"],
    title: "Goethe-Zertifikat B1",
  },
  {
    id: "work-email",
    level: "B1",
    goals: ["work"],
    title: "Eine E-Mail an die Kollegin",
  },
  {
    id: "health-pharmacy",
    level: "A1",
    goals: ["health"],
    title: "In der Apotheke",
  },
];

/** Returns three scenarios, preferring the learner's goals and level. */
export function recommendScenarios(
  input: { level: PlacementLevel; goals: readonly LearningGoal[] },
  catalog: readonly Scenario[] = SCENARIOS,
): Scenario[] {
  return [...catalog].sort((left, right) => compareScenarios(input, left, right)).slice(0, 3);
}

/** Orders a higher score first, then the scenario id, so the three results stay stable. */
function compareScenarios(
  input: { level: PlacementLevel; goals: readonly LearningGoal[] },
  left: Scenario,
  right: Scenario,
): number {
  const scoreDelta = scoreScenario(right, input) - scoreScenario(left, input);
  if (scoreDelta !== 0) return scoreDelta;
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

/**
 * Scores a shared goal above an exact level, and an exact level above a neighboring one.
 */
function scoreScenario(
  scenario: Scenario,
  input: { level: PlacementLevel; goals: readonly LearningGoal[] },
): number {
  const goalMatch = scenario.goals.some((goal) => input.goals.includes(goal)) ? 4 : 0;
  const levelMatch =
    scenario.level === input.level ? 2 : isAdjacent(scenario.level, input.level) ? 1 : 0;
  return goalMatch + levelMatch;
}

function isAdjacent(left: PlacementLevel, right: PlacementLevel): boolean {
  return Math.abs(LEVELS.indexOf(left) - LEVELS.indexOf(right)) === 1;
}
