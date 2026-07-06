import { useSyncExternalStore } from "react";

export type {
  AppRoute,
  AppState,
  CharacterSheetState,
  ChaosDeltaResult,
  CombatSliceState,
  DocumentState,
  OracleState,
  PersistenceState,
  PluginState,
  SessionState,
  StatDeltaResult,
  UiState,
} from "./appStore/types";
export { appStore } from "./appStore/store";
import { appStore } from "./appStore/store";
export {
  characterSheetStore,
  combatStore,
  documentStore,
  oracleStore,
  persistenceStore,
  pluginStore,
  sessionStore,
  uiStore,
} from "./appStore/stateCore";
import {
  characterSheetStore,
  combatStore,
  documentStore,
  oracleStore,
  persistenceStore,
  pluginStore,
  sessionStore,
  uiStore,
} from "./appStore/stateCore";

export function useAppStore() {
  return useSyncExternalStore(
    appStore.subscribe,
    appStore.getSnapshot,
    appStore.getSnapshot,
  );
}

export function useUiState() {
  return useSyncExternalStore(
    uiStore.subscribe,
    uiStore.getSnapshot,
    uiStore.getSnapshot,
  );
}

export function useSessionState() {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getSnapshot,
  );
}

export function useDocumentState() {
  return useSyncExternalStore(
    documentStore.subscribe,
    documentStore.getSnapshot,
    documentStore.getSnapshot,
  );
}

export function useCharacterSheetState() {
  return useSyncExternalStore(
    characterSheetStore.subscribe,
    characterSheetStore.getSnapshot,
    characterSheetStore.getSnapshot,
  );
}

export function useCombatSliceState() {
  return useSyncExternalStore(
    combatStore.subscribe,
    combatStore.getSnapshot,
    combatStore.getSnapshot,
  );
}

export function useOracleState() {
  return useSyncExternalStore(
    oracleStore.subscribe,
    oracleStore.getSnapshot,
    oracleStore.getSnapshot,
  );
}

export function usePluginState() {
  return useSyncExternalStore(
    pluginStore.subscribe,
    pluginStore.getSnapshot,
    pluginStore.getSnapshot,
  );
}

export function usePersistenceState() {
  return useSyncExternalStore(
    persistenceStore.subscribe,
    persistenceStore.getSnapshot,
    persistenceStore.getSnapshot,
  );
}
