import type { CharacterSheet } from "../../domain/domainTypes";
import {
  createUniqueCharacterSheetNick,
  findCharacterSheetForStatTarget,
  normalizeCharacterSheetNick,
} from "../../characterSheets/characterSheetLogic";
import {
  createFieldsFromTemplate,
  normalizeCharacterFields,
} from "../../characterSheets/characterSheetTemplateLogic";
import { createRepositories } from "../../persistence/sessionRepository";
import { setState, state } from "./stateCore";
import type { StatDeltaResult } from "./types";

export const characterSheetActions = {
  async saveActiveCharacterSheet(input: {
    name?: string;
    nick?: string | null;
    templateId?: string | null;
    templateName?: string | null;
    fields?: CharacterSheet["fields"];
  }) {
    if (!state.activeCharacterSheet) {
      return null;
    }

    const normalizedNick =
      input.nick === undefined
        ? undefined
        : normalizeCharacterSheetNick(input.nick ?? "") || null;

    if (normalizedNick) {
      const nickConflict = state.characterSheets.find(
        (sheet) =>
          sheet.id !== state.activeCharacterSheet?.id &&
          sheet.nick &&
          normalizeCharacterSheetNick(sheet.nick) === normalizedNick,
      );

      if (nickConflict) {
        setState({
          persistenceError: `Nick "${normalizedNick}" is already used by ${nickConflict.name}.`,
          persistenceMessage: "Sheet save failed.",
        });
        return null;
      }
    }

    const repositories = await createRepositories();
    const activeCharacterSheet = await repositories.characterSheets.update({
      id: state.activeCharacterSheet.id,
      ...input,
      nick: normalizedNick,
    });

    if (activeCharacterSheet) {
      const activeDocument =
        state.activeDocument?.characterSheetId === activeCharacterSheet.id
          ? {
              ...state.activeDocument,
              title: activeCharacterSheet.name,
            }
          : state.activeDocument;

      setState({
        activeDocument,
        activeCharacterSheet,
        campaignDocuments: state.campaignDocuments.map((document) =>
          document.characterSheetId === activeCharacterSheet.id
            ? { ...document, title: activeCharacterSheet.name }
            : document,
        ),
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
    const normalizedStatName = input.statName.trim().toLocaleLowerCase();
    const sheet = findCharacterSheetForStatTarget(
      state.characterSheets,
      input.sheetName,
    );

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
      const name = input.name.trim() || "New Character";
      const createdSheet = await repositories.characterSheets.create({
        sessionId: state.activeSession.id,
        name,
        nick: createUniqueCharacterSheetNick(name, state.characterSheets),
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
};
