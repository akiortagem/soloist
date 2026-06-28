import type { Combatant, CombatState } from "./combatTypes";

export function sortCombatantsByTurnOrder(combatants: Combatant[]) {
  return [...combatants].sort((a, b) => a.turnOrder - b.turnOrder);
}

function clampTurnIndex(index: number, combatantCount: number) {
  if (combatantCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), combatantCount - 1);
}

export function normalizeCombatState(combatState: CombatState): CombatState {
  const activeCombatantId =
    combatState.combatants[combatState.currentTurnIndex]?.id ?? null;
  const combatants = sortCombatantsByTurnOrder(combatState.combatants);
  const currentTurnIndex = activeCombatantId
    ? Math.max(
        0,
        combatants.findIndex((combatant) => combatant.id === activeCombatantId),
      )
    : clampTurnIndex(combatState.currentTurnIndex, combatants.length);

  return {
    ...combatState,
    combatants,
    currentTurnIndex: clampTurnIndex(currentTurnIndex, combatants.length),
    roundNumber: Math.max(1, combatState.roundNumber ?? 1),
  };
}

export function getNextTurnIndex(currentTurnIndex: number, combatantCount: number) {
  if (combatantCount <= 0) {
    return 0;
  }

  return (currentTurnIndex + 1) % combatantCount;
}

export function getNextRoundNumber(
  currentTurnIndex: number,
  combatantCount: number,
  roundNumber: number,
) {
  if (combatantCount <= 0) {
    return Math.max(1, roundNumber);
  }

  return currentTurnIndex >= combatantCount - 1
    ? Math.max(1, roundNumber) + 1
    : Math.max(1, roundNumber);
}

export function getPreviousTurnIndex(
  currentTurnIndex: number,
  combatantCount: number,
) {
  if (combatantCount <= 0) {
    return 0;
  }

  return (currentTurnIndex - 1 + combatantCount) % combatantCount;
}
