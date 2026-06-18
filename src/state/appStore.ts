import { useSyncExternalStore } from "react";
import type {
  CharacterSheet,
  CombatState,
  Document,
  Session,
} from "../domain/domainTypes";
import { createRepositories } from "../persistence/sessionRepository";

export type AppRoute = "sessions" | "templates" | "settings";

export type AppState = {
  route: AppRoute;
  sessions: Session[];
  activeSessionId?: string;
  activeSession: Session | null;
  activeDocument: Document | null;
  activeCharacterSheet: CharacterSheet | null;
  combatState: CombatState | null;
  chaosFactor: number;
  isLoadingSessions: boolean;
  isCreatingSession: boolean;
  persistenceMessage: string;
  persistenceError?: string;
};

const DEFAULT_CHAOS_FACTOR = 5;

const initialState: AppState = {
  route: "sessions",
  sessions: [],
  activeSession: null,
  activeDocument: null,
  activeCharacterSheet: null,
  combatState: null,
  chaosFactor: DEFAULT_CHAOS_FACTOR,
  isLoadingSessions: true,
  isCreatingSession: false,
  persistenceMessage: "Opening local database...",
};

let state = initialState;
const listeners = new Set<() => void>();

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function getActiveSession(sessions: Session[], activeSessionId?: string) {
  return (
    sessions.find((session) => session.id === activeSessionId) ??
    sessions[0] ??
    null
  );
}

async function loadActiveSessionData(activeSession: Session | null) {
  if (!activeSession) {
    setState({
      activeDocument: null,
      activeCharacterSheet: null,
      combatState: null,
      chaosFactor: DEFAULT_CHAOS_FACTOR,
    });
    return;
  }

  const repositories = await createRepositories();
  const document =
    (await repositories.documents.getBySessionId(activeSession.id)) ??
    (await repositories.documents.create({
      sessionId: activeSession.id,
      title: activeSession.name,
    }));
  const sheets = await repositories.characterSheets.listBySessionId(
    activeSession.id,
  );
  const activeCharacterSheet =
    sheets.find((sheet) => sheet.id === activeSession.activeCharacterSheetId) ??
    sheets[0] ??
    null;
  const combatState = await repositories.combat.getBySessionId(activeSession.id);

  setState({
    activeDocument: document,
    activeCharacterSheet,
    combatState,
    chaosFactor: activeSession.chaosFactor,
  });
}

export const appStore = {
  getSnapshot() {
    return state;
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setRoute(route: AppRoute) {
    setState({ route });
  },

  async loadSessions() {
    setState({
      isLoadingSessions: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const sessions = await repositories.sessions.list();
      const activeSession = getActiveSession(sessions, state.activeSessionId);

      setState({
        sessions,
        activeSessionId: activeSession?.id,
        activeSession,
        persistenceMessage:
          sessions.length > 0
            ? `Read ${sessions.length} session${
                sessions.length === 1 ? "" : "s"
              } from SQLite.`
            : "SQLite ready. Create a session.",
      });
      await loadActiveSessionData(activeSession);
    } catch (error) {
      setState({
        activeDocument: null,
        activeCharacterSheet: null,
        activeSession: null,
        activeSessionId: undefined,
        combatState: null,
        chaosFactor: DEFAULT_CHAOS_FACTOR,
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "SQLite unavailable.",
      });
    } finally {
      setState({ isLoadingSessions: false });
    }
  },

  async selectSession(sessionId: string) {
    const activeSession = getActiveSession(state.sessions, sessionId);

    setState({
      activeSessionId: activeSession?.id,
      activeSession,
      persistenceError: undefined,
    });
    await loadActiveSessionData(activeSession);
  },

  async createSession(name?: string) {
    setState({
      isCreatingSession: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const createdSession = await repositories.sessions.create({
        name: name ?? `Session ${new Date().toLocaleTimeString()}`,
      });
      const sessions = await repositories.sessions.list();
      const activeSession =
        sessions.find((session) => session.id === createdSession.id) ??
        createdSession;

      setState({
        sessions,
        activeSessionId: activeSession.id,
        activeSession,
        persistenceMessage: `Created ${activeSession.name}.`,
      });
      await loadActiveSessionData(activeSession);
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Session create failed.",
      });
    } finally {
      setState({ isCreatingSession: false });
    }
  },

  async saveActiveDocument(input: { title?: string; contentMarkdown?: string }) {
    if (!state.activeDocument) {
      return null;
    }

    const repositories = await createRepositories();
    const document = await repositories.documents.update({
      id: state.activeDocument.id,
      ...input,
    });

    if (document) {
      setState({ activeDocument: document });
    }

    return document;
  },

  async saveActiveCharacterSheet(input: {
    name?: string;
    fields?: CharacterSheet["fields"];
  }) {
    if (!state.activeCharacterSheet) {
      return null;
    }

    const repositories = await createRepositories();
    const activeCharacterSheet = await repositories.characterSheets.update({
      id: state.activeCharacterSheet.id,
      ...input,
    });

    if (activeCharacterSheet) {
      setState({ activeCharacterSheet });
    }

    return activeCharacterSheet;
  },

  async saveCombatState(input: {
    active?: boolean;
    combatants?: CombatState["combatants"];
    currentTurnIndex?: number;
  }) {
    if (!state.activeSession) {
      return null;
    }

    const repositories = await createRepositories();
    const combatState = await repositories.combat.upsert({
      sessionId: state.activeSession.id,
      ...input,
    });

    setState({ combatState });
    return combatState;
  },

  async saveChaosFactor(chaosFactor: number) {
    if (!state.activeSession) {
      return null;
    }

    const repositories = await createRepositories();
    const activeSession = await repositories.sessions.update({
      id: state.activeSession.id,
      chaosFactor,
    });

    if (!activeSession) {
      return null;
    }

    setState({
      activeSession,
      chaosFactor: activeSession.chaosFactor,
      sessions: state.sessions.map((session) =>
        session.id === activeSession.id ? activeSession : session,
      ),
    });

    return activeSession;
  },
};

export function useAppStore() {
  return useSyncExternalStore(
    appStore.subscribe,
    appStore.getSnapshot,
    appStore.getSnapshot,
  );
}
