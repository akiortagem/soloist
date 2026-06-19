export type ParsedRollCommand = {
  type: "roll";
  formula: string;
};

export type ParsedAskCommand = {
  type: "ask";
  odds: string;
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
  sheetName: string;
  statName: string;
  delta: number;
};

export type ParsedChaosCommand = {
  type: "chaos";
  delta: number;
};

export type ParsedUnknownCommand = {
  type: "unknown";
  raw: string;
  commandName?: string;
  reason: string;
};

export type ParsedCommand =
  | ParsedRollCommand
  | ParsedAskCommand
  | ParsedSceneCommand
  | ParsedCombatCommand
  | ParsedStatCommand
  | ParsedChaosCommand
  | ParsedUnknownCommand;
