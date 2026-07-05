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
  raw: string;
};

export type ParsedCombatCommand = {
  type: "combat";
  raw: string;
  action: "begin" | "turn" | "block" | "end";
};

export type ParsedStatCommand = {
  type: "stat";
  raw: string;
  sheetName: string;
  statName: string;
  delta: number;
};

export type ParsedTrackerStatCommand = {
  type: "trackerStat";
  raw: string;
  characterName: string;
  statName: string;
  mode: "increment" | "absolute";
  value: number;
};

export type ParsedChaosCommand = {
  type: "chaos";
  raw: string;
  delta: number;
};

export type ParsedPluginRandomTableCommand = {
  type: "pluginRandomTable";
  raw: string;
  commandName: string;
  pluginId: string;
  tableId: string;
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
  | ParsedTrackerStatCommand
  | ParsedChaosCommand
  | ParsedPluginRandomTableCommand
  | ParsedInvalidCommand
  | ParsedUnknownCommand;
