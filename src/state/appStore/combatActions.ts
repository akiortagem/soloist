import type {
  Combatant,
  CombatantTrackedField,
  CombatState,
} from "../../domain/domainTypes";
import {
  getNextRoundNumber,
  getNextTurnIndex,
  getPreviousTurnIndex,
  normalizeCombatState,
} from "../../combat/combatLogic";
import { createRepositories } from "../../persistence/sessionRepository";
import { setState, state } from "./stateCore";
import type { StatDeltaResult } from "./types";

const MAX_COMBATANT_FIELDS = 3;
const MAX_COMBAT_TEXT_LENGTH = 15;

function createClientId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sanitizeCombatantField(
  field: CombatantTrackedField,
): CombatantTrackedField {
  if (field.type !== "text") {
    return field;
  }

  return {
    ...field,
    value: field.value.slice(0, MAX_COMBAT_TEXT_LENGTH),
  };
}

function sanitizeCombatant(combatant: Combatant): Combatant {
  return {
    ...combatant,
    name: combatant.name.trim() || "Unnamed",
    fields: combatant.fields
      ?.slice(0, MAX_COMBATANT_FIELDS)
      .map(sanitizeCombatantField),
  };
}

function normalizeLookupName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function createUniqueCombatantName(name: string, combatants: Combatant[]) {
  const baseName = name.trim() || "Unnamed";
  const usedNames = new Set(
    combatants.map((combatant) => normalizeLookupName(combatant.name)),
  );

  if (!usedNames.has(normalizeLookupName(baseName))) {
    return baseName;
  }

  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${baseName} ${suffix}`;

    if (!usedNames.has(normalizeLookupName(candidate))) {
      return candidate;
    }
  }

  return `${baseName} ${Date.now().toString(36)}`;
}

export const combatActions = {
  applyTrackerStatChange(input: {
    characterName: string;
    statName: string;
    mode: "increment" | "absolute";
    value: number;
  }): StatDeltaResult {
    if (!state.combatState) {
      return {
        ok: false,
        reason: "No combat tracker",
      };
    }

    const normalizedCharacterName = normalizeLookupName(input.characterName);
    const combatant =
      state.combatState.combatants.find(
        (candidate) =>
          normalizeLookupName(candidate.name) === normalizedCharacterName,
      ) ?? null;

    if (!combatant) {
      return {
        ok: false,
        reason: `Tracker character "${input.characterName}" was not found`,
      };
    }

    if (combatant.characterSheetId) {
      return {
        ok: false,
        reason: `${combatant.name} is linked to a character sheet; use /stat without tracker`,
      };
    }

    const normalizedStatName = normalizeLookupName(input.statName);
    const field =
      combatant.fields?.find(
        (candidate) =>
          candidate.type === "number" &&
          normalizeLookupName(candidate.name) === normalizedStatName,
      ) ?? null;

    if (!field || field.type !== "number") {
      return {
        ok: false,
        reason: `Numeric tracker stat "${input.statName}" was not found on ${combatant.name}`,
      };
    }

    const beforeValue = field.value;
    const unclampedAfterValue =
      input.mode === "increment" ? beforeValue + input.value : input.value;
    const afterValue = Math.min(
      field.maxValue,
      Math.max(field.minValue, unclampedAfterValue),
    );
    const delta = afterValue - beforeValue;
    const updatedCombatant: Combatant = {
      ...combatant,
      fields: (combatant.fields ?? []).map((candidate) =>
        candidate.id === field.id
          ? {
              ...field,
              value: afterValue,
            }
          : candidate,
      ),
    };
    const nextState = normalizeCombatState({
      ...state.combatState,
      combatants: state.combatState.combatants.map((candidate) =>
        candidate.id === combatant.id ? updatedCombatant : candidate,
      ),
      updatedAt: new Date().toISOString(),
    });

    void this.saveCombatState({
      active: nextState.active,
      combatants: nextState.combatants,
      currentTurnIndex: nextState.currentTurnIndex,
      roundNumber: nextState.roundNumber,
    });

    return {
      ok: true,
      sheetName: combatant.name,
      statName: field.name,
      delta,
      changeText:
        input.mode === "absolute" ? `=${input.value}` : String(input.value),
      beforeValue,
      afterValue,
    };
  },

  async saveCombatState(input: {
    active?: boolean;
    combatants?: CombatState["combatants"];
    currentTurnIndex?: number;
    roundNumber?: number;
  }) {
    if (!state.activeSession) {
      return null;
    }

    const repositories = await createRepositories();
    const combatState = normalizeCombatState(
      await repositories.combat.upsert({
        sessionId: state.activeSession.id,
        ...input,
      }),
    );

    setState({
      combatState,
      persistenceError: undefined,
      persistenceMessage: "Combat tracker saved.",
    });
    return combatState;
  },

  async startCombat() {
    if (!state.activeSession) {
      return null;
    }

    return this.saveCombatState({
      active: true,
      combatants: state.combatState?.combatants ?? [],
      currentTurnIndex: state.combatState?.currentTurnIndex ?? 0,
      roundNumber: state.combatState?.roundNumber ?? 1,
    });
  },

  async addCombatant(
    input: Omit<Combatant, "id"> & {
      id?: string;
    },
  ) {
    if (!state.activeSession) {
      return null;
    }

    const currentCombatState =
      state.combatState ??
      (await this.saveCombatState({
        active: true,
        combatants: [],
        currentTurnIndex: 0,
      }));

    if (!currentCombatState) {
      return null;
    }

    const combatant = sanitizeCombatant({
      id: input.id ?? createClientId("combatant"),
      name: createUniqueCombatantName(
        input.name.trim() || "Unnamed",
        currentCombatState.combatants,
      ),
      turnOrder: input.turnOrder,
      characterSheetId: input.characterSheetId,
      notes: input.notes,
      fields: input.fields ?? [],
    });
    const combatants = [...currentCombatState.combatants];
    const insertIndex = Math.min(
      Math.max(combatant.turnOrder - 1, 0),
      combatants.length,
    );
    combatants.splice(insertIndex, 0, combatant);

    const nextState = normalizeCombatState({
      ...currentCombatState,
      active: true,
      combatants: combatants.map((candidate, index) => ({
        ...candidate,
        turnOrder: index + 1,
      })),
      updatedAt: new Date().toISOString(),
    });

    return this.saveCombatState({
      active: nextState.active,
      combatants: nextState.combatants,
      currentTurnIndex: nextState.currentTurnIndex,
    });
  },

  async updateCombatant(combatant: Combatant) {
    if (!state.combatState) {
      return null;
    }

    const nextState = normalizeCombatState({
      ...state.combatState,
      combatants: state.combatState.combatants.map((candidate) =>
        candidate.id === combatant.id
          ? sanitizeCombatant(combatant)
          : candidate,
      ),
      updatedAt: new Date().toISOString(),
    });

    return this.saveCombatState({
      active: nextState.active,
      combatants: nextState.combatants,
      currentTurnIndex: nextState.currentTurnIndex,
    });
  },

  async removeCombatant(combatantId: string) {
    if (!state.combatState) {
      return null;
    }

    const activeCombatantId =
      state.combatState.combatants[state.combatState.currentTurnIndex]?.id;
    const combatants = state.combatState.combatants
      .filter((combatant) => combatant.id !== combatantId)
      .map((combatant, index) => ({
        ...combatant,
        turnOrder: index + 1,
      }));
    const currentTurnIndex =
      activeCombatantId && activeCombatantId !== combatantId
        ? Math.max(
            0,
            combatants.findIndex((combatant) => combatant.id === activeCombatantId),
          )
        : Math.min(state.combatState.currentTurnIndex, combatants.length - 1);
    const nextState = normalizeCombatState({
      ...state.combatState,
      combatants,
      currentTurnIndex: Math.max(0, currentTurnIndex),
      updatedAt: new Date().toISOString(),
    });

    return this.saveCombatState({
      active: nextState.active,
      combatants: nextState.combatants,
      currentTurnIndex: nextState.currentTurnIndex,
    });
  },

  async moveCombatantTurnOrder(
    combatantId: string,
    direction: "up" | "down",
  ) {
    if (!state.combatState) {
      return null;
    }

    const activeCombatantId =
      state.combatState.combatants[state.combatState.currentTurnIndex]?.id;
    const combatants = [...state.combatState.combatants];
    const currentIndex = combatants.findIndex(
      (combatant) => combatant.id === combatantId,
    );
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= combatants.length
    ) {
      return state.combatState;
    }

    const movingCombatant = combatants[currentIndex];
    combatants[currentIndex] = combatants[targetIndex];
    combatants[targetIndex] = movingCombatant;

    const renumberedCombatants = combatants.map((combatant, index) => ({
      ...combatant,
      turnOrder: index + 1,
    }));
    const currentTurnIndex = activeCombatantId
      ? Math.max(
          0,
          renumberedCombatants.findIndex(
            (combatant) => combatant.id === activeCombatantId,
          ),
        )
      : state.combatState.currentTurnIndex;

    return this.saveCombatState({
      active: state.combatState.active,
      combatants: renumberedCombatants,
      currentTurnIndex,
    });
  },

  async nextCombatTurn() {
    if (!state.combatState) {
      return null;
    }

    const currentTurnIndex = getNextTurnIndex(
      state.combatState.currentTurnIndex,
      state.combatState.combatants.length,
    );
    const roundNumber = getNextRoundNumber(
      state.combatState.currentTurnIndex,
      state.combatState.combatants.length,
      state.combatState.roundNumber,
    );

    return this.saveCombatState({
      currentTurnIndex,
      roundNumber,
    });
  },

  async previousCombatTurn() {
    if (!state.combatState) {
      return null;
    }

    return this.saveCombatState({
      currentTurnIndex: getPreviousTurnIndex(
        state.combatState.currentTurnIndex,
        state.combatState.combatants.length,
      ),
    });
  },
};
