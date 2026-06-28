import { useSyncExternalStore } from "react";
import type {
  CharacterSheet,
  CharacterSheetTemplate,
  CharacterTemplateItem,
  Combatant,
  CombatantTrackedField,
  CombatState,
  Document,
  Session,
} from "../domain/domainTypes";
import {
  createFieldsFromTemplate,
  normalizeCharacterFields,
  normalizeTemplateItems,
  syncFieldsWithTemplate,
} from "../characterSheets/characterSheetTemplateLogic";
import {
  getNextTurnIndex,
  getNextRoundNumber,
  getPreviousTurnIndex,
  normalizeCombatState,
} from "../combat/combatLogic";
import { createRepositories } from "../persistence/sessionRepository";

export type AppRoute =
  | "sessions"
  | "characterSheets"
  | "characterSheetBuilder"
  | "templates"
  | "settings";

export type AppState = {
  route: AppRoute;
  sessions: Session[];
  activeSessionId?: string;
  activeSession: Session | null;
  activeDocument: Document | null;
  characterSheets: CharacterSheet[];
  activeCharacterSheet: CharacterSheet | null;
  characterSheetTemplates: CharacterSheetTemplate[];
  activeTemplateId?: string;
  activeTemplate: CharacterSheetTemplate | null;
  combatState: CombatState | null;
  chaosFactor: number;
  isLoadingSessions: boolean;
  isCreatingSession: boolean;
  isLoadingTemplates: boolean;
  isSavingTemplate: boolean;
  persistenceMessage: string;
  persistenceError?: string;
  documentSaveState: "idle" | "pending" | "saved" | "error";
  rightPanelOpenRequest: number;
  rightPanelCloseRequest: number;
};

const DEFAULT_CHAOS_FACTOR = 5;
const MAX_COMBATANT_FIELDS = 3;
const MAX_COMBAT_TEXT_LENGTH = 15;

function createClientId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sanitizeCombatantField(
  field: CombatantTrackedField,
): CombatantTrackedField {
  if (field.type !== "text") {
    return field;
  }

  return {
    ...field,
    value: field.value.slice(0, MAX_COMBAT_TEXT_LENGTH),
  };
}

function sanitizeCombatant(combatant: Combatant): Combatant {
  return {
    ...combatant,
    name: combatant.name.trim() || "Unnamed",
    fields: combatant.fields
      ?.slice(0, MAX_COMBATANT_FIELDS)
      .map(sanitizeCombatantField),
  };
}

function normalizeLookupName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function createUniqueCombatantName(name: string, combatants: Combatant[]) {
  const baseName = name.trim() || "Unnamed";
  const usedNames = new Set(
    combatants.map((combatant) => normalizeLookupName(combatant.name)),
  );

  if (!usedNames.has(normalizeLookupName(baseName))) {
    return baseName;
  }

  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${baseName} ${suffix}`;

    if (!usedNames.has(normalizeLookupName(candidate))) {
      return candidate;
    }
  }

  return `${baseName} ${Date.now().toString(36)}`;
}

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

const initialState: AppState = {
  route: "sessions",
  sessions: [],
  activeSession: null,
  activeDocument: null,
  characterSheets: [],
  activeCharacterSheet: null,
  characterSheetTemplates: [],
  activeTemplate: null,
  combatState: null,
  chaosFactor: DEFAULT_CHAOS_FACTOR,
  isLoadingSessions: true,
  isCreatingSession: false,
  isLoadingTemplates: false,
  isSavingTemplate: false,
  persistenceMessage: "Opening local database...",
  documentSaveState: "idle",
  rightPanelOpenRequest: 0,
  rightPanelCloseRequest: 0,
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
      characterSheets: [],
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
  const loadedSheets = await repositories.characterSheets.listBySessionId(
    activeSession.id,
  );
  const sheets = loadedSheets.map((sheet) => ({
    ...sheet,
    fields: normalizeCharacterFields(sheet.fields),
  }));
  const activeCharacterSheet =
    sheets.find((sheet) => sheet.id === activeSession.activeCharacterSheetId) ??
    sheets[0] ??
    null;
  const combatState = await repositories.combat.getBySessionId(activeSession.id);

  setState({
    activeDocument: document,
    characterSheets: sheets,
    activeCharacterSheet,
    combatState: combatState ? normalizeCombatState(combatState) : null,
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

  requestRightPanelOpen() {
    setState({ rightPanelOpenRequest: state.rightPanelOpenRequest + 1 });
  },

  requestRightPanelClose() {
    setState({ rightPanelCloseRequest: state.rightPanelCloseRequest + 1 });
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
        characterSheets: [],
        activeCharacterSheet: null,
        activeSession: null,
        activeSessionId: undefined,
        combatState: null,
        documentSaveState: "error",
        chaosFactor: DEFAULT_CHAOS_FACTOR,
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "SQLite unavailable.",
      });
    } finally {
      setState({ isLoadingSessions: false });
    }
  },

  async loadTemplates() {
    setState({
      isLoadingTemplates: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const loadedTemplates = await repositories.characterSheets.listTemplates();
      const characterSheetTemplates = loadedTemplates.map((template) => ({
        ...template,
        fields: normalizeTemplateItems(template.fields),
      }));
      const activeTemplate =
        characterSheetTemplates.find(
          (template) => template.id === state.activeTemplateId,
        ) ??
        characterSheetTemplates[0] ??
        null;

      setState({
        characterSheetTemplates,
        activeTemplateId: activeTemplate?.id,
        activeTemplate,
        persistenceMessage:
          characterSheetTemplates.length > 0
            ? `Read ${characterSheetTemplates.length} template${
                characterSheetTemplates.length === 1 ? "" : "s"
              } from SQLite.`
            : "No templates yet.",
      });
    } catch (error) {
      setState({
        characterSheetTemplates: [],
        activeTemplate: null,
        activeTemplateId: undefined,
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template load failed.",
      });
    } finally {
      setState({ isLoadingTemplates: false });
    }
  },

  selectTemplate(templateId: string) {
    const activeTemplate =
      state.characterSheetTemplates.find(
        (template) => template.id === templateId,
      ) ?? null;

    setState({
      activeTemplateId: activeTemplate?.id,
      activeTemplate,
      persistenceError: undefined,
    });
  },

  async createTemplate(input?: {
    name?: string;
    fields?: CharacterTemplateItem[];
  }) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const createdTemplate = await repositories.characterSheets.createTemplate({
        name: input?.name?.trim() || "New Template",
        fields: normalizeTemplateItems(input?.fields ?? []),
      });
      const characterSheetTemplates =
        await repositories.characterSheets.listTemplates();
      const activeTemplate =
        characterSheetTemplates.find(
          (template) => template.id === createdTemplate.id,
        ) ?? createdTemplate;

      setState({
        characterSheetTemplates,
        activeTemplateId: activeTemplate.id,
        activeTemplate,
        persistenceMessage: `Created template ${activeTemplate.name}.`,
      });

      return activeTemplate;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template create failed.",
      });
      return null;
    } finally {
      setState({ isSavingTemplate: false });
    }
  },

  async saveTemplate(input: {
    id: string;
    name?: string;
    fields?: CharacterTemplateItem[];
  }) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const activeTemplate = await repositories.characterSheets.updateTemplate({
        id: input.id,
        name: input.name?.trim() || undefined,
        fields: input.fields ? normalizeTemplateItems(input.fields) : undefined,
      });

      if (!activeTemplate) {
        return null;
      }

      const templateSheets =
        await repositories.characterSheets.listByTemplateId(activeTemplate.id);
      const syncedSheets: CharacterSheet[] = [];

      for (const sheet of templateSheets) {
        const fields = syncFieldsWithTemplate(sheet.fields, activeTemplate.fields);

        if (JSON.stringify(fields) === JSON.stringify(sheet.fields)) {
          syncedSheets.push(sheet);
          continue;
        }

        const updatedSheet = await repositories.characterSheets.update({
          id: sheet.id,
          fields,
        });

        syncedSheets.push(updatedSheet ?? sheet);
      }

      setState({
        activeTemplate,
        activeTemplateId: activeTemplate.id,
        characterSheetTemplates: state.characterSheetTemplates.map((template) =>
          template.id === activeTemplate.id ? activeTemplate : template,
        ),
        activeCharacterSheet:
          syncedSheets.find(
            (sheet) => sheet.id === state.activeCharacterSheet?.id,
          ) ?? state.activeCharacterSheet,
        characterSheets: state.characterSheets.map(
          (sheet) =>
            syncedSheets.find((syncedSheet) => syncedSheet.id === sheet.id) ??
            sheet,
        ),
        persistenceMessage: `Saved template ${activeTemplate.name}.`,
      });

      return activeTemplate;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template save failed.",
      });
      return null;
    } finally {
      setState({ isSavingTemplate: false });
    }
  },

  async deleteTemplate(templateId: string) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      await repositories.characterSheets.deleteTemplate(templateId);
      const characterSheetTemplates =
        await repositories.characterSheets.listTemplates();
      const activeTemplate =
        state.activeTemplateId === templateId
          ? (characterSheetTemplates[0] ?? null)
          : (characterSheetTemplates.find(
              (template) => template.id === state.activeTemplateId,
            ) ?? null);

      setState({
        characterSheetTemplates,
        activeTemplateId: activeTemplate?.id,
        activeTemplate,
        persistenceMessage: "Template deleted.",
      });
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template delete failed.",
      });
    } finally {
      setState({ isSavingTemplate: false });
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

  setDocumentSavePending() {
    setState({
      documentSaveState: "pending",
      persistenceError: undefined,
      persistenceMessage: "Saving document...",
    });
  },

  async saveDocument(
    documentId: string,
    input: { title?: string; contentMarkdown?: string },
  ) {
    try {
      const repositories = await createRepositories();
      const document = await repositories.documents.update({
        id: documentId,
        ...input,
      });

      if (document) {
        setState({
          activeDocument:
            state.activeDocument?.id === document.id
              ? document
              : state.activeDocument,
          documentSaveState: "saved",
          persistenceError: undefined,
          persistenceMessage: "Document saved to SQLite.",
        });
      }

      return document;
    } catch (error) {
      setState({
        documentSaveState: "error",
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Document save failed.",
      });
      return null;
    }
  },

  async saveActiveDocument(input: { title?: string; contentMarkdown?: string }) {
    if (!state.activeDocument) {
      return null;
    }

    return this.saveDocument(state.activeDocument.id, input);
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
      setState({
        activeCharacterSheet,
        characterSheets: state.characterSheets.map((sheet) =>
          sheet.id === activeCharacterSheet.id ? activeCharacterSheet : sheet,
        ),
        persistenceError: undefined,
        persistenceMessage: `Saved sheet ${activeCharacterSheet.name}.`,
      });
    }

    return activeCharacterSheet;
  },

  async updateCharacterSheetField(
    sheetId: string,
    fieldId: string,
    value: CharacterSheet["fields"][number]["value"],
  ) {
    const sheet =
      state.characterSheets.find((candidate) => candidate.id === sheetId) ??
      null;

    if (!sheet) {
      return null;
    }

    const fields = normalizeCharacterFields(
      sheet.fields.map((field) =>
        field.id === fieldId ? { ...field, value } : field,
      ),
    );
    const updatedSheet: CharacterSheet = {
      ...sheet,
      fields,
      updatedAt: new Date().toISOString(),
    };

    setState({
      activeCharacterSheet:
        state.activeCharacterSheet?.id === updatedSheet.id
          ? updatedSheet
          : state.activeCharacterSheet,
      characterSheets: state.characterSheets.map((candidate) =>
        candidate.id === updatedSheet.id ? updatedSheet : candidate,
      ),
      persistenceError: undefined,
      persistenceMessage: `Saved sheet ${updatedSheet.name}.`,
    });

    try {
      const repositories = await createRepositories();
      const savedSheet = await repositories.characterSheets.update({
        id: updatedSheet.id,
        fields,
      });

      if (savedSheet) {
        const normalizedSavedSheet = {
          ...savedSheet,
          fields: normalizeCharacterFields(savedSheet.fields),
        };

        setState({
          activeCharacterSheet:
            state.activeCharacterSheet?.id === normalizedSavedSheet.id
              ? normalizedSavedSheet
              : state.activeCharacterSheet,
          characterSheets: state.characterSheets.map((candidate) =>
            candidate.id === normalizedSavedSheet.id
              ? normalizedSavedSheet
              : candidate,
          ),
        });

        return normalizedSavedSheet;
      }

      return updatedSheet;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Sheet field update failed.",
      });
      return null;
    }
  },

  applyStatDelta(input: {
    sheetName: string;
    statName: string;
    delta: number;
  }): StatDeltaResult {
    const normalizedSheetName = input.sheetName.trim().toLocaleLowerCase();
    const normalizedStatName = input.statName.trim().toLocaleLowerCase();
    const sheet =
      state.characterSheets.find(
        (candidate) =>
          candidate.name.trim().toLocaleLowerCase() === normalizedSheetName,
      ) ?? null;

    if (!sheet) {
      return {
        ok: false,
        reason: `Character sheet "${input.sheetName}" was not found`,
      };
    }

    const field =
      sheet.fields.find(
        (candidate) =>
          candidate.name.trim().toLocaleLowerCase() === normalizedStatName,
      ) ?? null;

    if (!field) {
      return {
        ok: false,
        reason: `Stat "${input.statName}" was not found on ${sheet.name}`,
      };
    }

    if (field.type === "current_max_number") {
      const value =
        field.value && typeof field.value === "object"
          ? (field.value as { current?: unknown; max?: unknown })
          : {};
      const beforeValue =
        typeof value.current === "number" && Number.isFinite(value.current)
          ? Math.max(0, value.current)
          : 0;
      const max =
        typeof value.max === "number" && Number.isFinite(value.max)
          ? Math.max(0, value.max)
          : 0;
      const afterValue = Math.max(0, beforeValue + input.delta);
      const updatedSheet: CharacterSheet = {
        ...sheet,
        fields: sheet.fields.map((candidate) =>
          candidate.id === field.id
            ? {
                ...candidate,
                value: {
                  current: afterValue,
                  max,
                },
              }
            : candidate,
        ),
        updatedAt: new Date().toISOString(),
      };

      setState({
        activeCharacterSheet:
          state.activeCharacterSheet?.id === updatedSheet.id
            ? updatedSheet
            : state.activeCharacterSheet,
        characterSheets: state.characterSheets.map((candidate) =>
          candidate.id === updatedSheet.id ? updatedSheet : candidate,
        ),
        persistenceError: undefined,
        persistenceMessage: `Updated ${updatedSheet.name} ${field.name}.`,
      });

      void createRepositories()
        .then((repositories) =>
          repositories.characterSheets.update({
            id: updatedSheet.id,
            fields: updatedSheet.fields,
          }),
        )
        .catch((error) => {
          setState({
            persistenceError:
              error instanceof Error ? error.message : String(error),
            persistenceMessage: "Stat update failed.",
          });
        });

      return {
        ok: true,
        sheetName: updatedSheet.name,
        statName: field.name,
        delta: input.delta,
        beforeValue,
        afterValue,
      };
    }

    if (field.type !== "number" || typeof field.value !== "number") {
      return {
        ok: false,
        reason: `${sheet.name} ${field.name} is not numeric`,
      };
    }

    const beforeValue = field.value;
    const afterValue = beforeValue + input.delta;
    const updatedSheet: CharacterSheet = {
      ...sheet,
      fields: sheet.fields.map((candidate) =>
        candidate.id === field.id
          ? {
              ...candidate,
              value: afterValue,
            }
          : candidate,
      ),
      updatedAt: new Date().toISOString(),
    };

    setState({
      activeCharacterSheet:
        state.activeCharacterSheet?.id === updatedSheet.id
          ? updatedSheet
          : state.activeCharacterSheet,
      characterSheets: state.characterSheets.map((candidate) =>
        candidate.id === updatedSheet.id ? updatedSheet : candidate,
      ),
      persistenceError: undefined,
      persistenceMessage: `Updated ${updatedSheet.name} ${field.name}.`,
    });

    void createRepositories()
      .then((repositories) =>
        repositories.characterSheets.update({
          id: updatedSheet.id,
          fields: updatedSheet.fields,
        }),
      )
      .catch((error) => {
        setState({
          persistenceError: error instanceof Error ? error.message : String(error),
          persistenceMessage: "Stat update failed.",
        });
      });

    return {
      ok: true,
      sheetName: updatedSheet.name,
      statName: field.name,
      delta: input.delta,
      beforeValue,
      afterValue,
    };
  },

  applyTrackerStatChange(input: {
    characterName: string;
    statName: string;
    mode: "increment" | "absolute";
    value: number;
  }): StatDeltaResult {
    if (!state.combatState) {
      return {
        ok: false,
        reason: "No combat tracker",
      };
    }

    const normalizedCharacterName = normalizeLookupName(input.characterName);
    const combatant =
      state.combatState.combatants.find(
        (candidate) =>
          normalizeLookupName(candidate.name) === normalizedCharacterName,
      ) ?? null;

    if (!combatant) {
      return {
        ok: false,
        reason: `Tracker character "${input.characterName}" was not found`,
      };
    }

    if (combatant.characterSheetId) {
      return {
        ok: false,
        reason: `${combatant.name} is linked to a character sheet; use /stat without tracker`,
      };
    }

    const normalizedStatName = normalizeLookupName(input.statName);
    const field =
      combatant.fields?.find(
        (candidate) =>
          candidate.type === "number" &&
          normalizeLookupName(candidate.name) === normalizedStatName,
      ) ?? null;

    if (!field || field.type !== "number") {
      return {
        ok: false,
        reason: `Numeric tracker stat "${input.statName}" was not found on ${combatant.name}`,
      };
    }

    const beforeValue = field.value;
    const unclampedAfterValue =
      input.mode === "increment" ? beforeValue + input.value : input.value;
    const afterValue = Math.min(
      field.maxValue,
      Math.max(field.minValue, unclampedAfterValue),
    );
    const delta = afterValue - beforeValue;
    const updatedCombatant: Combatant = {
      ...combatant,
      fields: (combatant.fields ?? []).map((candidate) =>
        candidate.id === field.id
          ? {
              ...field,
              value: afterValue,
            }
          : candidate,
      ),
    };
    const nextState = normalizeCombatState({
      ...state.combatState,
      combatants: state.combatState.combatants.map((candidate) =>
        candidate.id === combatant.id ? updatedCombatant : candidate,
      ),
      updatedAt: new Date().toISOString(),
    });

    void this.saveCombatState({
      active: nextState.active,
      combatants: nextState.combatants,
      currentTurnIndex: nextState.currentTurnIndex,
      roundNumber: nextState.roundNumber,
    });

    return {
      ok: true,
      sheetName: combatant.name,
      statName: field.name,
      delta,
      changeText:
        input.mode === "absolute" ? `=${input.value}` : String(input.value),
      beforeValue,
      afterValue,
    };
  },

  applyChaosDelta(input: { delta: number }): ChaosDeltaResult {
    if (!state.activeSession) {
      return {
        ok: false,
        reason: "No active session",
      };
    }

    const beforeValue = state.activeSession.chaosFactor;
    const afterValue = Math.min(9, Math.max(1, beforeValue + input.delta));
    const activeSession: Session = {
      ...state.activeSession,
      chaosFactor: afterValue,
      updatedAt: new Date().toISOString(),
    };

    setState({
      activeSession,
      chaosFactor: afterValue,
      sessions: state.sessions.map((session) =>
        session.id === activeSession.id ? activeSession : session,
      ),
      persistenceError: undefined,
      persistenceMessage: "Updated Chaos Factor.",
    });

    void createRepositories()
      .then((repositories) =>
        repositories.sessions.update({
          id: activeSession.id,
          chaosFactor: afterValue,
        }),
      )
      .then((savedSession) => {
        if (!savedSession) {
          return;
        }

        setState({
          activeSession: savedSession,
          chaosFactor: savedSession.chaosFactor,
          sessions: state.sessions.map((session) =>
            session.id === savedSession.id ? savedSession : session,
          ),
        });
      })
      .catch((error) => {
        setState({
          persistenceError: error instanceof Error ? error.message : String(error),
          persistenceMessage: "Chaos Factor update failed.",
        });
      });

    return {
      ok: true,
      delta: input.delta,
      beforeValue,
      afterValue,
    };
  },

  async selectCharacterSheet(sheetId: string) {
    if (!state.activeSession) {
      return null;
    }

    const activeCharacterSheet =
      state.characterSheets.find((sheet) => sheet.id === sheetId) ?? null;

    if (!activeCharacterSheet) {
      return null;
    }

    const repositories = await createRepositories();
    const activeSession = await repositories.sessions.update({
      id: state.activeSession.id,
      activeCharacterSheetId: activeCharacterSheet.id,
    });

    setState({
      activeCharacterSheet,
      activeSession: activeSession ?? state.activeSession,
      activeSessionId: activeSession?.id ?? state.activeSessionId,
      sessions: activeSession
        ? state.sessions.map((session) =>
            session.id === activeSession.id ? activeSession : session,
          )
        : state.sessions,
      persistenceError: undefined,
    });

    return activeCharacterSheet;
  },

  async createCharacterSheet(input: {
    name: string;
    templateId: string;
  }) {
    if (!state.activeSession) {
      return null;
    }

    const template =
      state.characterSheetTemplates.find(
        (candidate) => candidate.id === input.templateId,
      ) ?? null;

    if (!template) {
      setState({
        persistenceError: "Choose an existing character sheet template.",
        persistenceMessage: "Sheet create failed.",
      });
      return null;
    }

    try {
      const repositories = await createRepositories();
      const createdSheet = await repositories.characterSheets.create({
        sessionId: state.activeSession.id,
        name: input.name.trim() || "New Character",
        templateId: template.id,
        templateName: template.name,
        fields: createFieldsFromTemplate(template.fields),
      });
      const activeSession = await repositories.sessions.update({
        id: state.activeSession.id,
        activeCharacterSheetId: createdSheet.id,
      });
      const characterSheets = await repositories.characterSheets.listBySessionId(
        state.activeSession.id,
      );
      const activeCharacterSheet =
        characterSheets.find((sheet) => sheet.id === createdSheet.id) ??
        createdSheet;

      setState({
        activeCharacterSheet,
        characterSheets,
        activeSession: activeSession ?? state.activeSession,
        activeSessionId: activeSession?.id ?? state.activeSessionId,
        sessions: activeSession
          ? state.sessions.map((session) =>
              session.id === activeSession.id ? activeSession : session,
            )
          : state.sessions,
        persistenceError: undefined,
        persistenceMessage: `Created sheet ${activeCharacterSheet.name}.`,
      });

      return activeCharacterSheet;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Sheet create failed.",
      });
      return null;
    }
  },

  async deleteCharacterSheet(sheetId: string) {
    if (!state.activeSession) {
      return;
    }

    try {
      const repositories = await createRepositories();
      await repositories.characterSheets.delete(sheetId);
      const characterSheets = await repositories.characterSheets.listBySessionId(
        state.activeSession.id,
      );
      const activeCharacterSheet =
        state.activeCharacterSheet?.id === sheetId
          ? (characterSheets[0] ?? null)
          : (characterSheets.find(
              (sheet) => sheet.id === state.activeCharacterSheet?.id,
            ) ?? null);
      const activeSession = await repositories.sessions.update({
        id: state.activeSession.id,
        activeCharacterSheetId: activeCharacterSheet?.id ?? null,
      });

      setState({
        activeCharacterSheet,
        characterSheets,
        activeSession: activeSession ?? state.activeSession,
        activeSessionId: activeSession?.id ?? state.activeSessionId,
        sessions: activeSession
          ? state.sessions.map((session) =>
              session.id === activeSession.id ? activeSession : session,
            )
          : state.sessions,
        persistenceError: undefined,
        persistenceMessage: "Character sheet deleted.",
      });
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Sheet delete failed.",
      });
    }
  },

  async saveCombatState(input: {
    active?: boolean;
    combatants?: CombatState["combatants"];
    currentTurnIndex?: number;
    roundNumber?: number;
  }) {
    if (!state.activeSession) {
      return null;
    }

    const repositories = await createRepositories();
    const combatState = normalizeCombatState(
      await repositories.combat.upsert({
      sessionId: state.activeSession.id,
      ...input,
      }),
    );

    setState({
      combatState,
      persistenceError: undefined,
      persistenceMessage: "Combat tracker saved.",
    });
    return combatState;
  },

  async startCombat() {
    if (!state.activeSession) {
      return null;
    }

    return this.saveCombatState({
      active: true,
      combatants: state.combatState?.combatants ?? [],
      currentTurnIndex: state.combatState?.currentTurnIndex ?? 0,
      roundNumber: state.combatState?.roundNumber ?? 1,
    });
  },

  async addCombatant(
    input: Omit<Combatant, "id"> & {
      id?: string;
    },
  ) {
    if (!state.activeSession) {
      return null;
    }

    const currentCombatState =
      state.combatState ??
      (await this.saveCombatState({
        active: true,
        combatants: [],
        currentTurnIndex: 0,
      }));

    if (!currentCombatState) {
      return null;
    }

    const combatant = sanitizeCombatant({
      id: input.id ?? createClientId("combatant"),
      name: createUniqueCombatantName(
        input.name.trim() || "Unnamed",
        currentCombatState.combatants,
      ),
      turnOrder: input.turnOrder,
      characterSheetId: input.characterSheetId,
      notes: input.notes,
      fields: input.fields ?? [],
    });
    const combatants = [...currentCombatState.combatants];
    const insertIndex = Math.min(
      Math.max(combatant.turnOrder - 1, 0),
      combatants.length,
    );
    combatants.splice(insertIndex, 0, combatant);

    const nextState = normalizeCombatState({
      ...currentCombatState,
      active: true,
      combatants: combatants.map((candidate, index) => ({
        ...candidate,
        turnOrder: index + 1,
      })),
      updatedAt: new Date().toISOString(),
    });

    return this.saveCombatState({
      active: nextState.active,
      combatants: nextState.combatants,
      currentTurnIndex: nextState.currentTurnIndex,
    });
  },

  async updateCombatant(combatant: Combatant) {
    if (!state.combatState) {
      return null;
    }

    const nextState = normalizeCombatState({
      ...state.combatState,
      combatants: state.combatState.combatants.map((candidate) =>
        candidate.id === combatant.id
          ? sanitizeCombatant(combatant)
          : candidate,
      ),
      updatedAt: new Date().toISOString(),
    });

    return this.saveCombatState({
      active: nextState.active,
      combatants: nextState.combatants,
      currentTurnIndex: nextState.currentTurnIndex,
    });
  },

  async removeCombatant(combatantId: string) {
    if (!state.combatState) {
      return null;
    }

    const activeCombatantId =
      state.combatState.combatants[state.combatState.currentTurnIndex]?.id;
    const combatants = state.combatState.combatants
      .filter((combatant) => combatant.id !== combatantId)
      .map((combatant, index) => ({
        ...combatant,
        turnOrder: index + 1,
      }));
    const currentTurnIndex =
      activeCombatantId && activeCombatantId !== combatantId
        ? Math.max(
            0,
            combatants.findIndex((combatant) => combatant.id === activeCombatantId),
          )
        : Math.min(state.combatState.currentTurnIndex, combatants.length - 1);
    const nextState = normalizeCombatState({
      ...state.combatState,
      combatants,
      currentTurnIndex: Math.max(0, currentTurnIndex),
      updatedAt: new Date().toISOString(),
    });

    return this.saveCombatState({
      active: nextState.active,
      combatants: nextState.combatants,
      currentTurnIndex: nextState.currentTurnIndex,
    });
  },

  async moveCombatantTurnOrder(
    combatantId: string,
    direction: "up" | "down",
  ) {
    if (!state.combatState) {
      return null;
    }

    const activeCombatantId =
      state.combatState.combatants[state.combatState.currentTurnIndex]?.id;
    const combatants = [...state.combatState.combatants];
    const currentIndex = combatants.findIndex(
      (combatant) => combatant.id === combatantId,
    );
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= combatants.length
    ) {
      return state.combatState;
    }

    const movingCombatant = combatants[currentIndex];
    combatants[currentIndex] = combatants[targetIndex];
    combatants[targetIndex] = movingCombatant;

    const renumberedCombatants = combatants.map((combatant, index) => ({
      ...combatant,
      turnOrder: index + 1,
    }));
    const currentTurnIndex = activeCombatantId
      ? Math.max(
          0,
          renumberedCombatants.findIndex(
            (combatant) => combatant.id === activeCombatantId,
          ),
        )
      : state.combatState.currentTurnIndex;

    return this.saveCombatState({
      active: state.combatState.active,
      combatants: renumberedCombatants,
      currentTurnIndex,
    });
  },

  async nextCombatTurn() {
    if (!state.combatState) {
      return null;
    }

    const currentTurnIndex = getNextTurnIndex(
      state.combatState.currentTurnIndex,
      state.combatState.combatants.length,
    );
    const roundNumber = getNextRoundNumber(
      state.combatState.currentTurnIndex,
      state.combatState.combatants.length,
      state.combatState.roundNumber,
    );

    return this.saveCombatState({
      currentTurnIndex,
      roundNumber,
    });
  },

  async previousCombatTurn() {
    if (!state.combatState) {
      return null;
    }

    return this.saveCombatState({
      currentTurnIndex: getPreviousTurnIndex(
        state.combatState.currentTurnIndex,
        state.combatState.combatants.length,
      ),
    });
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
