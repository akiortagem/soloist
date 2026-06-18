import type { DiceRoll } from "./diceTypes";

export function rollDice(formula: string): DiceRoll {
  return { formula, total: 0 };
}
