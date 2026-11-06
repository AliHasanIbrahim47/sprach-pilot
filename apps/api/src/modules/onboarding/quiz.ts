import type { PlacementLevel, QuizItem } from "@sprachpilot/shared";

export interface PlacementItem extends QuizItem {
  correctChoiceId: string;
}

const A2: PlacementLevel = "A2";

function choice(id: string, text: string): { id: string; text: string } {
  return { id, text };
}

export const QUIZ_ITEMS: readonly PlacementItem[] = [
  {
    id: "a2-reading-rent",
    kind: "reading",
    level: A2,
    prompt: "Was kostet die Wohnung?",
    passage: "Die Wohnung hat zwei Zimmer und eine Küche. Sie kostet 800 Euro warm.",
    transcript: null,
    choices: [
      choice("a", "800 Euro warm"),
      choice("b", "800 Euro kalt"),
      choice("c", "zwei Zimmer"),
    ],
    correctChoiceId: "a",
  },
  {
    id: "a2-reading-office",
    kind: "reading",
    level: A2,
    prompt: "Was sollen Sie mitbringen?",
    passage: "Bitte bringen Sie Ihren Pass und die Wohnungsgeberbestätigung mit.",
    transcript: null,
    choices: [
      choice("a", "nur ein Foto"),
      choice("b", "Pass und Wohnungsgeberbestätigung"),
      choice("c", "den Mietvertrag"),
    ],
    correctChoiceId: "b",
  },
  {
    id: "a2-reading-appointment",
    kind: "reading",
    level: A2,
    prompt: "Wann ist der Termin?",
    passage: "Der Termin ist am Dienstag um 9 Uhr.",
    transcript: null,
    choices: [
      choice("a", "Montag, 9 Uhr"),
      choice("b", "Dienstag, 19 Uhr"),
      choice("c", "Dienstag, 9 Uhr"),
    ],
    correctChoiceId: "c",
  },
  {
    id: "a2-reading-probation",
    kind: "reading",
    level: A2,
    prompt: "Wie lang ist die Probezeit?",
    passage: "Die Probezeit dauert sechs Monate.",
    transcript: null,
    choices: [choice("a", "sechs Wochen"), choice("b", "sechs Monate"), choice("c", "ein Jahr")],
    correctChoiceId: "b",
  },
  {
    id: "a2-reading-medicine",
    kind: "reading",
    level: A2,
    prompt: "Wie sollen Sie die Tabletten nehmen?",
    passage: "Nehmen Sie die Tabletten dreimal täglich nach dem Essen.",
    transcript: null,
    choices: [
      choice("a", "einmal vor dem Essen"),
      choice("b", "dreimal täglich vor dem Essen"),
      choice("c", "dreimal täglich nach dem Essen"),
    ],
    correctChoiceId: "c",
  },
  {
    id: "a2-listening-hours",
    kind: "listening",
    level: A2,
    prompt: "Wann ist die Sprechstunde?",
    passage: null,
    transcript: "Guten Tag, die Sprechstunde ist heute von 8 bis 12 Uhr.",
    choices: [
      choice("a", "morgen von 8 bis 12 Uhr"),
      choice("b", "heute von 8 bis 12 Uhr"),
      choice("c", "heute von 12 bis 18 Uhr"),
    ],
    correctChoiceId: "b",
  },
  {
    id: "a2-listening-order",
    kind: "listening",
    level: A2,
    prompt: "Welche Nummer hat die Bestellung?",
    passage: null,
    transcript: "Ihre Bestellung ist die Nummer 42. Bitte warten Sie an der Theke.",
    choices: [choice("a", "24"), choice("b", "40"), choice("c", "42")],
    correctChoiceId: "c",
  },
  {
    id: "a2-listening-platform",
    kind: "listening",
    level: A2,
    prompt: "Von welchem Gleis fährt der Zug?",
    passage: null,
    transcript: "Der Zug nach Hamburg fährt von Gleis 7 ab.",
    choices: [choice("a", "Gleis 7"), choice("b", "Gleis 17"), choice("c", "Gleis 1")],
    correctChoiceId: "a",
  },
  {
    id: "a2-listening-rent-due",
    kind: "listening",
    level: A2,
    prompt: "Wann ist die Miete fällig?",
    passage: null,
    transcript: "Die Miete ist am dritten Werktag fällig.",
    choices: [
      choice("a", "am dritten Sonntag"),
      choice("b", "am dritten Werktag"),
      choice("c", "am ersten Werktag"),
    ],
    correctChoiceId: "b",
  },
  {
    id: "a2-listening-room",
    kind: "listening",
    level: A2,
    prompt: "Was sucht die Person?",
    passage: null,
    transcript: "Ich suche ein Zimmer in der Nähe der U-Bahn.",
    choices: [
      choice("a", "ein Haus auf dem Land"),
      choice("b", "ein Büro in der Stadt"),
      choice("c", "ein Zimmer nahe der U-Bahn"),
    ],
    correctChoiceId: "c",
  },
];

export function toPublicQuizItem(item: PlacementItem): QuizItem {
  return {
    id: item.id,
    kind: item.kind,
    level: item.level,
    prompt: item.prompt,
    passage: item.passage,
    transcript: item.transcript,
    choices: item.choices,
  };
}
