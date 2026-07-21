import type {
  CharacterSheet,
  CharacterSheetTemplate,
  CombatState,
  Document,
  Session,
} from "../../domain/domainTypes";
import type { PluginStatus } from "../../features/plugins";

export type AppRoute =
  | "sessions"
  | "characterSheets"
  | "characterSheetBuilder"
  | "templates"
  | "settings";

export type UiState = {
  route: AppRoute;
  rightPanelOpenRequest: number;
  rightPanelCloseRequest: number;
};

export type SessionState = {
  sessions: Session[];
  activeSessionId?: string;
  activeSession: Session | null;
  chaosFactor: number;
  isLoadingSessions: boolean;
  isCreatingSession: boolean;
};

export type DocumentState = {
  campaignDocuments: Document[];
  activeDocument: Document | null;
  documentSaveState: "idle" | "pending" | "saved" | "error";
};

export type CharacterSheetState = {
  characterSheets: CharacterSheet[];
  activeCharacterSheet: CharacterSheet | null;
  characterSheetTemplates: CharacterSheetTemplate[];
  activeTemplateId?: string;
  activeTemplate: CharacterSheetTemplate | null;
  isLoadingTemplates: boolean;
  isSavingTemplate: boolean;
};

export type CombatSliceState = {
  combatState: CombatState | null;
};

export type OracleState = {
  activeOracleProviderId: string;
};

export type PluginState = {
  pluginStatuses: PluginStatus[];
};

export type PersistenceState = {
  persistenceMessage: string;
  persistenceError?: string;
};

export type AppState = UiState &
  SessionState &
  DocumentState &
  CharacterSheetState &
  CombatSliceState &
  OracleState &
  PluginState &
  PersistenceState;

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
  | {
      ok: false;
      reason: string;
    };

export type ChaosDeltaResult =
  | {
      ok: true;
      delta: number;
      beforeValue: number;
      afterValue: number;
    }
  | {
      ok: false;
      reason: string;
    };
