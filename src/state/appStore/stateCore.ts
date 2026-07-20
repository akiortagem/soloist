import { getActiveOracleProvider } from "../../oracle/oracleRegistry";
import { createSignalStore } from "../createSignalStore";
import type {
  AppState,
  CharacterSheetState,
  CombatSliceState,
  DocumentState,
  OracleState,
  PersistenceState,
  PluginState,
  SessionState,
  UiState,
} from "./types";

export const DEFAULT_CHAOS_FACTOR = 5;
export const ACTIVE_ORACLE_PROVIDER_SETTING_KEY = "oracle.activeProviderId";

export const uiStore = createSignalStore<UiState>({
  route: "sessions",
  rightPanelOpenRequest: 0,
  rightPanelCloseRequest: 0,
});

export const sessionStore = createSignalStore<SessionState>({
  sessions: [],
  activeSession: null,
  chaosFactor: DEFAULT_CHAOS_FACTOR,
  isLoadingSessions: true,
  isCreatingSession: false,
});

export const documentStore = createSignalStore<DocumentState>({
  campaignDocuments: [],
  activeDocument: null,
  documentSaveState: "idle",
});

export const characterSheetStore = createSignalStore<CharacterSheetState>({
  characterSheets: [],
  activeCharacterSheet: null,
  characterSheetTemplates: [],
  activeTemplate: null,
  isLoadingTemplates: false,
  isSavingTemplate: false,
});

export const combatStore = createSignalStore<CombatSliceState>({
  combatState: null,
});

export const oracleStore = createSignalStore<OracleState>({
  activeOracleProviderId: getActiveOracleProvider().id,
});

export const pluginStore = createSignalStore<PluginState>({
  pluginStatuses: [],
});

export const persistenceStore = createSignalStore<PersistenceState>({
  persistenceMessage: "Opening local database...",
});

const compatibilityListeners = new Set<() => void>();
let isApplyingCompatibilityPatch = false;

function composeState(): AppState {
  return {
    ...uiStore.getSnapshot(),
    ...sessionStore.getSnapshot(),
    ...documentStore.getSnapshot(),
    ...characterSheetStore.getSnapshot(),
    ...combatStore.getSnapshot(),
    ...oracleStore.getSnapshot(),
    ...pluginStore.getSnapshot(),
    ...persistenceStore.getSnapshot(),
  };
}

export let state = composeState();

function syncCompatibilityState() {
  state = composeState();
}

function notifyCompatibilityListeners() {
  compatibilityListeners.forEach((listener) => listener());
}

for (const store of [
  uiStore,
  sessionStore,
  documentStore,
  characterSheetStore,
  combatStore,
  oracleStore,
  pluginStore,
  persistenceStore,
]) {
  store.subscribe(() => {
    syncCompatibilityState();

    if (!isApplyingCompatibilityPatch) {
      notifyCompatibilityListeners();
    }
  });
}

function hasOwn<TObject extends object>(
  object: Partial<TObject>,
  key: keyof TObject,
) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function pickPatch<TSlice extends object>(
  patch: Partial<AppState>,
  keys: readonly (keyof TSlice)[],
): Partial<TSlice> | null {
  const slicePatch: Partial<TSlice> = {};

  for (const key of keys) {
    if (hasOwn(patch, key as keyof AppState)) {
      slicePatch[key] = patch[key as keyof AppState] as TSlice[keyof TSlice];
    }
  }

  return Object.keys(slicePatch).length > 0 ? slicePatch : null;
}

export function getSnapshot() {
  return state;
}

export function subscribe(listener: () => void) {
  compatibilityListeners.add(listener);
  return () => {
    compatibilityListeners.delete(listener);
  };
}

export function setState(patch: Partial<AppState>) {
  isApplyingCompatibilityPatch = true;

  const uiPatch = pickPatch<UiState>(patch, [
    "route",
    "rightPanelOpenRequest",
    "rightPanelCloseRequest",
  ]);
  const sessionPatch = pickPatch<SessionState>(patch, [
    "sessions",
    "activeSessionId",
    "activeSession",
    "chaosFactor",
    "isLoadingSessions",
    "isCreatingSession",
  ]);
  const documentPatch = pickPatch<DocumentState>(patch, [
    "campaignDocuments",
    "activeDocument",
    "documentSaveState",
  ]);
  const characterSheetPatch = pickPatch<CharacterSheetState>(patch, [
    "characterSheets",
    "activeCharacterSheet",
    "characterSheetTemplates",
    "activeTemplateId",
    "activeTemplate",
    "isLoadingTemplates",
    "isSavingTemplate",
  ]);
  const combatPatch = pickPatch<CombatSliceState>(patch, ["combatState"]);
  const oraclePatch = pickPatch<OracleState>(patch, ["activeOracleProviderId"]);
  const pluginPatch = pickPatch<PluginState>(patch, ["pluginStatuses"]);
  const persistencePatch = pickPatch<PersistenceState>(patch, [
    "persistenceMessage",
    "persistenceError",
  ]);

  if (uiPatch) uiStore.setState(uiPatch);
  if (sessionPatch) sessionStore.setState(sessionPatch);
  if (documentPatch) documentStore.setState(documentPatch);
  if (characterSheetPatch) characterSheetStore.setState(characterSheetPatch);
  if (combatPatch) combatStore.setState(combatPatch);
  if (oraclePatch) oracleStore.setState(oraclePatch);
  if (pluginPatch) pluginStore.setState(pluginPatch);
  if (persistencePatch) persistenceStore.setState(persistencePatch);

  syncCompatibilityState();
  isApplyingCompatibilityPatch = false;
  notifyCompatibilityListeners();
}
