import type { OracleOdds } from "../oracle/oracleTypes";

export type { OracleOdds };

export type ParsedRollCommand = {
  type: "roll";
  raw: string;
  formula: string;
};

export type ParsedAskCommand = {
  type: "ask";
  raw: string;
  odds: OracleOdds;
  question: string;
};

export type ParsedSceneCommand = {
  type: "scene";
  prompt: string;
};

export type ParsedCombatCommand = {
  type: "combat";
};

export type ParsedStatCommand = {
  type: "stat";
  raw: string;
  sheetName: string;
  statName: string;
  delta: number;
};

export type ParsedChaosCommand = {
  type: "chaos";
  raw: string;
  delta: number;
};

export type ParsedUnknownCommand = {
  type: "unknown";
  raw: string;
  commandName?: string;
  reason: string;
};

export type ParsedInvalidCommand = {
  type: "invalid";
  raw: string;
  commandName: string;
  reason: string;
};

export type ParsedCommand =
  | ParsedRollCommand
  | ParsedAskCommand
  | ParsedSceneCommand
  | ParsedCombatCommand
  | ParsedStatCommand
  | ParsedChaosCommand
  | ParsedInvalidCommand
  | ParsedUnknownCommand;
