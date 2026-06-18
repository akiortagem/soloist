import type { Combatant } from "./combatTypes";

export function sortCombatantsByInitiative(combatants: Combatant[]) {
  return [...combatants].sort((a, b) => b.initiative - a.initiative);
}
