export type Session = {
  id: string;
  name: string;
  documentId: string;
  chaosFactor: number;
  activeCharacterSheetId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Document = {
  id: string;
  sessionId: string;
  title: string;
  contentMarkdown: string;
  createdAt: string;
  updatedAt: string;
};

export type CharacterField = {
  id: string;
  name: string;
  type: "number" | "text" | "boolean" | "longText";
  value: string | number | boolean;
  maxValue?: number;
  minValue?: number;
  group?: string;
};

export type CharacterSheet = {
  id: string;
  sessionId: string;
  name: string;
  fields: CharacterField[];
  createdAt: string;
  updatedAt: string;
};

export type CharacterTemplateField = {
  id: string;
  name: string;
  type: "number" | "text" | "boolean" | "longText";
  defaultValue: string | number | boolean;
  maxValue?: number;
  minValue?: number;
  group?: string;
};

export type CharacterSheetTemplate = {
  id: string;
  name: string;
  fields: CharacterTemplateField[];
  createdAt: string;
  updatedAt: string;
};

export type Combatant = {
  id: string;
  name: string;
  initiative: number;
  characterSheetId?: string;
  notes?: string;
};

export type CombatState = {
  id: string;
  sessionId: string;
  active: boolean;
  combatants: Combatant[];
  currentTurnIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type ResultBlock = {
  id: string;
  type: "roll" | "oracle" | "scene" | "combat" | "stat" | "chaos" | "error";
  createdAt: string;
  commandText: string;
  collapsed?: boolean;
  payload: unknown;
};
