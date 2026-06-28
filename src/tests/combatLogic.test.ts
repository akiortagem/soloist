import { describe, expect, it } from "vitest";
import {
  getNextRoundNumber,
  getNextTurnIndex,
  getPreviousTurnIndex,
  normalizeCombatState,
} from "../combat/combatLogic";
import type { CombatState } from "../combat/combatTypes";

function createState(input: Partial<CombatState>): CombatState {
  return {
    id: "combat_1",
    sessionId: "session_1",
    active: true,
    combatants: [],
    currentTurnIndex: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    roundNumber: 1,
    ...input,
  };
}

describe("combat logic", () => {
  it("sorts combatants by turn order ascending", () => {
    const state = normalizeCombatState(
      createState({
        combatants: [
          { id: "slow", name: "Slow", turnOrder: 3 },
          { id: "bandit", name: "Bandit", turnOrder: 2 },
          { id: "quick", name: "Quick", turnOrder: 1 },
        ],
      }),
    );

    expect(state.combatants.map((combatant) => combatant.name)).toEqual([
      "Quick",
      "Bandit",
      "Slow",
    ]);
  });

  it("keeps the active combatant selected after sorting", () => {
    const state = normalizeCombatState(
      createState({
        currentTurnIndex: 0,
        combatants: [
          { id: "bandit", name: "Bandit", turnOrder: 2 },
          { id: "quick", name: "Quick", turnOrder: 1 },
        ],
      }),
    );

    expect(state.combatants[state.currentTurnIndex]?.id).toBe("bandit");
  });

  it("wraps next and previous turn indexes", () => {
    expect(getNextTurnIndex(2, 3)).toBe(0);
    expect(getPreviousTurnIndex(0, 3)).toBe(2);
    expect(getNextTurnIndex(0, 0)).toBe(0);
    expect(getPreviousTurnIndex(0, 0)).toBe(0);
  });

  it("increments the round when turn order wraps", () => {
    expect(getNextRoundNumber(0, 3, 1)).toBe(1);
    expect(getNextRoundNumber(2, 3, 1)).toBe(2);
    expect(getNextRoundNumber(0, 0, 1)).toBe(1);
  });
});
