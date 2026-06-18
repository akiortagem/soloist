export type ParsedCommand =
  | { type: "roll"; formula: string }
  | { type: "ask"; odds: string; question: string }
  | { type: "scene"; prompt: string }
  | { type: "combat" }
  | { type: "stat"; sheetName: string; statName: string; delta: number }
  | { type: "chaos"; delta: number }
  | { type: "unknown"; raw: string };
