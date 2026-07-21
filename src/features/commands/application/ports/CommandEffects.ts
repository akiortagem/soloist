import type { CombatState } from "../../../../domain/domainTypes";
import type { OracleProvider } from "../../../../oracle/OracleProvider";
import type { OracleTableDefinition } from "../../../../oracle/oracleRegistry";
export type StatDeltaResult =
  | {
      ok: true;
      sheetName: string;
      statName: string;
      delta: number;
      changeText?: string;
      beforeValue: number;
      afterValue: number;
    }
  | { ok: false; reason: string };

export type ChaosDeltaResult =
  | { ok: true; delta: number; beforeValue: number; afterValue: number }
  | { ok: false; reason: string };

export type CommandSnapshot = {
  hasActiveSession: boolean;
  combatState: CombatState | null;
};

export type CombatStatePatch = {
  active?: boolean;
  currentTurnIndex?: number;
  roundNumber?: number;
};

export interface CommandEffects {
  snapshot(): CommandSnapshot;
  applyStatDelta(input: {
    sheetName: string;
    statName: string;
    delta: number;
  }): StatDeltaResult;
  applyTrackerStatChange(input: {
    characterName: string;
    statName: string;
    mode: "increment" | "absolute";
    value: number;
  }): StatDeltaResult;
  applyChaosDelta(input: { delta: number }): ChaosDeltaResult;
  startCombat(): void;
  saveCombatState(input: CombatStatePatch): void;
  requestCombatPanel(state: "open" | "closed"): void;
}

export interface CommandValues {
  id(prefix: string): string;
  now(): string;
  random(): number;
  activeOracle(): OracleProvider;
  oracleTable(id: string): OracleTableDefinition | undefined;
}
