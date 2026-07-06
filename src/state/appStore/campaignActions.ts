import { createUniqueCharacterSheetNick } from "../../characterSheets/characterSheetLogic";
import { createRepositories } from "../../persistence/sessionRepository";
import {
  getActiveSession,
  loadActiveSessionData,
} from "./activeSessionData";
import { setState, state } from "./stateCore";

export const campaignActions = {
  async selectSession(sessionId: string) {
    const activeSession = getActiveSession(state.sessions, sessionId);

    setState({
      activeSessionId: activeSession?.id,
      activeSession,
      activeDocument: null,
      campaignDocuments: [],
      route: "sessions",
      persistenceError: undefined,
    });
    await loadActiveSessionData(activeSession);
  },

  async selectDocument(documentId: string) {
    const activeDocument =
      state.campaignDocuments.find((document) => document.id === documentId) ??
      null;

    if (!activeDocument) {
      return null;
    }

    const activeCharacterSheet =
      activeDocument.kind === "character" && activeDocument.characterSheetId
        ? (state.characterSheets.find(
            (sheet) => sheet.id === activeDocument.characterSheetId,
          ) ?? state.activeCharacterSheet)
        : state.activeCharacterSheet;

    setState({
      activeDocument,
      activeCharacterSheet,
      route: "sessions",
      persistenceError: undefined,
    });

    return activeDocument;
  },

  async createSession(name?: string) {
    setState({
      isCreatingSession: true,
      persistenceError: undefined,
    });

    try {
      const repositories = await createRepositories();
      const createdSession = await repositories.sessions.create({
        name: name?.trim() || "Untitled",
      });
      const sessions = await repositories.sessions.list();
      const activeSession =
        sessions.find((session) => session.id === createdSession.id) ??
        createdSession;

      setState({
        sessions,
        activeSessionId: activeSession.id,
        activeSession,
        route: "sessions",
        persistenceMessage: `Created ${activeSession.name}.`,
      });
      await loadActiveSessionData(activeSession);
      return activeSession;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Session create failed.",
      });
      return null;
    } finally {
      setState({ isCreatingSession: false });
    }
  },

  async renameSession(sessionId: string, name: string) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    try {
      const repositories = await createRepositories();
      const updatedSession = await repositories.sessions.update({
        id: sessionId,
        name: trimmedName,
      });

      if (!updatedSession) {
        return null;
      }

      const campaignDocument = await repositories.documents.update({
        id: updatedSession.documentId,
        title: trimmedName,
      });

      setState({
        activeSession:
          state.activeSession?.id === updatedSession.id
            ? updatedSession
            : state.activeSession,
        activeSessionId:
          state.activeSessionId === updatedSession.id
            ? updatedSession.id
            : state.activeSessionId,
        sessions: state.sessions.map((session) =>
          session.id === updatedSession.id ? updatedSession : session,
        ),
        activeDocument:
          state.activeDocument?.id === campaignDocument?.id
            ? campaignDocument
            : state.activeDocument,
        campaignDocuments: campaignDocument
          ? state.campaignDocuments.map((document) =>
              document.id === campaignDocument.id ? campaignDocument : document,
            )
          : state.campaignDocuments,
        persistenceError: undefined,
        persistenceMessage: `Renamed campaign to ${updatedSession.name}.`,
      });

      return updatedSession;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Campaign rename failed.",
      });
      return null;
    }
  },

  async deleteSession(sessionId: string) {
    try {
      const repositories = await createRepositories();
      await repositories.sessions.delete(sessionId);
      const sessions = await repositories.sessions.list();
      const activeSession =
        state.activeSessionId === sessionId
          ? getActiveSession(sessions)
          : getActiveSession(sessions, state.activeSessionId);

      setState({
        sessions,
        activeSessionId: activeSession?.id,
        activeSession,
        activeDocument: null,
        campaignDocuments: [],
        characterSheets: [],
        activeCharacterSheet: null,
        combatState: null,
        persistenceError: undefined,
        persistenceMessage: "Campaign deleted.",
      });
      await loadActiveSessionData(activeSession);
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Campaign delete failed.",
      });
    }
  },

  async createDocumentInFolder(input: {
    parentId: string;
    kind: "session" | "document";
    title?: string;
  }) {
    const parent = state.campaignDocuments.find(
      (document) => document.id === input.parentId && document.kind === "folder",
    );

    if (!state.activeSession || !parent) {
      return null;
    }

    try {
      const repositories = await createRepositories();
      const title =
        input.title?.trim() ||
        (input.kind === "session" ? "Untitled" : "Untitled Document");
      const document = await repositories.documents.create({
        sessionId: state.activeSession.id,
        parentId: parent.id,
        kind: input.kind,
        title,
      });
      const campaignDocuments = await repositories.documents.listBySessionId(
        state.activeSession.id,
      );

      setState({
        activeDocument: document,
        campaignDocuments,
        route: "sessions",
        persistenceError: undefined,
        persistenceMessage: `Created ${document.title}.`,
      });

      return document;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Document create failed.",
      });
      return null;
    }
  },

  async createCharacterInFolder(parentId: string) {
    if (!state.activeSession) {
      return null;
    }

    const parent = state.campaignDocuments.find(
      (document) =>
        document.id === parentId &&
        document.kind === "folder" &&
        document.folderKind === "characters",
    );

    if (!parent) {
      return null;
    }

    try {
      const repositories = await createRepositories();
      const sheet = await repositories.characterSheets.create({
        sessionId: state.activeSession.id,
        name: "Untitled",
        nick: createUniqueCharacterSheetNick("Untitled", state.characterSheets),
      });
      const document = await repositories.documents.create({
        sessionId: state.activeSession.id,
        parentId: parent.id,
        kind: "character",
        characterSheetId: sheet.id,
        title: sheet.name,
      });
      const campaignDocuments = await repositories.documents.listBySessionId(
        state.activeSession.id,
      );

      setState({
        activeDocument: document,
        activeCharacterSheet: sheet,
        characterSheets: [sheet, ...state.characterSheets],
        campaignDocuments,
        route: "sessions",
        persistenceError: undefined,
        persistenceMessage: `Created character ${sheet.name}.`,
      });

      return document;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Character create failed.",
      });
      return null;
    }
  },

  async deleteDocument(documentId: string) {
    const document = state.campaignDocuments.find(
      (candidate) => candidate.id === documentId,
    );

    if (!state.activeSession || !document) {
      return;
    }

    try {
      const repositories = await createRepositories();
      const deletedIds = await repositories.documents.delete(documentId);
      if (document.kind === "character" && document.characterSheetId) {
        await repositories.characterSheets.delete(document.characterSheetId);
      }
      const campaignDocuments = await repositories.documents.listBySessionId(
        state.activeSession.id,
      );
      const characterSheets =
        document.kind === "character" && document.characterSheetId
          ? state.characterSheets.filter(
              (sheet) => sheet.id !== document.characterSheetId,
            )
          : state.characterSheets;
      const activeDocument =
        state.activeDocument && !deletedIds.includes(state.activeDocument.id)
          ? state.activeDocument
          : (campaignDocuments.find((candidate) => candidate.kind !== "folder") ??
            null);
      const activeCharacterSheet =
        document.kind === "character" &&
        document.characterSheetId === state.activeCharacterSheet?.id
          ? (characterSheets[0] ?? null)
          : state.activeCharacterSheet;

      setState({
        activeDocument,
        campaignDocuments,
        characterSheets,
        activeCharacterSheet,
        persistenceError: undefined,
        persistenceMessage: `${document.title} deleted.`,
      });
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Document delete failed.",
      });
    }
  },

  async createFolder(parentId?: string) {
    if (!state.activeSession) {
      return null;
    }

    try {
      const repositories = await createRepositories();
      const folder = await repositories.documents.create({
        sessionId: state.activeSession.id,
        parentId,
        kind: "folder",
        title: "New Folder",
      });
      const campaignDocuments = await repositories.documents.listBySessionId(
        state.activeSession.id,
      );

      setState({
        campaignDocuments,
        persistenceError: undefined,
        persistenceMessage: `Created folder ${folder.title}.`,
      });

      return folder;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Folder create failed.",
      });
      return null;
    }
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
        let activeCharacterSheet = state.activeCharacterSheet;
        let characterSheets = state.characterSheets;

        if (
          input.title &&
          document.kind === "character" &&
          document.characterSheetId
        ) {
          const sheet = await repositories.characterSheets.update({
            id: document.characterSheetId,
            name: input.title,
          });

          if (sheet) {
            activeCharacterSheet =
              state.activeCharacterSheet?.id === sheet.id
                ? sheet
                : state.activeCharacterSheet;
            characterSheets = state.characterSheets.map((candidate) =>
              candidate.id === sheet.id ? sheet : candidate,
            );
          }
        }

        setState({
          activeDocument:
            state.activeDocument?.id === document.id
              ? document
              : state.activeDocument,
          activeCharacterSheet,
          characterSheets,
          campaignDocuments: state.campaignDocuments.map((candidate) =>
            candidate.id === document.id ? document : candidate,
          ),
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
};
