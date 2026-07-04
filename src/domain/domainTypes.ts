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
  parentId?: string;
  kind: "folder" | "session" | "document" | "character";
  folderKind?: "characters" | "sessions";
  characterSheetId?: string;
  title: string;
  contentMarkdown: string;
  createdAt: string;
  updatedAt: string;
};

export type CurrentMaxNumberValue = {
  current: number;
  max: number;
};

export type CharacterFieldType =
  | "number"
  | "current_max_number"
  | "text"
  | "boolean"
  | "longText";

export type CharacterFieldValue =
  | string
  | number
  | boolean
  | CurrentMaxNumberValue;

export type CharacterField = {
  id: string;
  templateFieldId?: string;
  name: string;
  type: CharacterFieldType;
  value: CharacterFieldValue;
  maxValue?: number;
  minValue?: number;
  group?: string;
};

export type CharacterSheet = {
  id: string;
  sessionId: string;
  name: string;
  nick?: string;
  templateId?: string;
  templateName?: string;
  fields: CharacterField[];
  createdAt: string;
  updatedAt: string;
};

export type CharacterTemplateField = {
  id: string;
  kind?: "field";
  name: string;
  type: CharacterFieldType;
  defaultValue: CharacterFieldValue;
  maxValue?: number;
  minValue?: number;
  group?: string;
};

export type CharacterTemplateSeparator = {
  id: string;
  kind: "separator";
  label?: string;
};

export type CharacterTemplateGroup = {
  id: string;
  kind: "group";
  name: string;
  fields: CharacterTemplateField[];
};

export type CharacterTemplateLayoutColumn = {
  id: string;
  fields: CharacterTemplateItem[];
};

export type CharacterTemplateLayout = {
  id: string;
  kind: "layout";
  columns: CharacterTemplateLayoutColumn[];
};

export type CharacterTemplateItem =
  | CharacterTemplateField
  | CharacterTemplateSeparator
  | CharacterTemplateGroup
  | CharacterTemplateLayout;

export type CharacterSheetTemplate = {
  id: string;
  name: string;
  fields: CharacterTemplateItem[];
  createdAt: string;
  updatedAt: string;
};

export type CombatantTrackedField =
  | {
      id: string;
      name: string;
      type: "sheet";
      characterFieldId: string;
    }
  | {
      id: string;
      name: string;
      type: "boolean";
      value: boolean;
    }
  | {
      id: string;
      name: string;
      type: "number";
      value: number;
      maxValue: number;
      minValue: number;
    }
  | {
      id: string;
      name: string;
      type: "text";
      value: string;
    };

export type Combatant = {
  id: string;
  name: string;
  turnOrder: number;
  characterSheetId?: string;
  notes?: string;
  fields?: CombatantTrackedField[];
};

export type CombatState = {
  id: string;
  sessionId: string;
  active: boolean;
  combatants: Combatant[];
  currentTurnIndex: number;
  roundNumber: number;
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

export type SceneContainerPayload = {
  id: string;
  description: string;
  descriptionLocked: boolean;
  oracleResult?: {
    chaosFactor: number;
    roll: number;
    adjustmentType: string;
    providerId: string;
    providerName: string;
    explanation: string;
  };
  oracleError?: string;
  collapsed?: boolean;
};

export type CombatSpacePayload = {
  id: string;
  active: boolean;
  ended: boolean;
  roundNumber: number;
  currentTurnIndex: number;
};

export type CombatTurnBlockPayload = {
  id: string;
  combatantId: string;
  combatantName: string;
  roundNumber: number;
  turnIndex: number;
  current: boolean;
  collapsed?: boolean;
};
