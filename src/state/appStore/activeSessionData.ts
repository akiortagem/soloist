import type { Session } from "../../domain/domainTypes";
import { normalizeCharacterFields } from "../../characterSheets/characterSheetTemplateLogic";
import { normalizeCombatState } from "../../combat/combatLogic";
import { createRepositories } from "../../persistence/sessionRepository";
import { DEFAULT_CHAOS_FACTOR, setState, state } from "./stateCore";

export function getActiveSession(
  sessions: Session[],
  activeSessionId?: string,
) {
  return (
    sessions.find((session) => session.id === activeSessionId) ??
    sessions[0] ??
    null
  );
}

export async function loadActiveSessionData(activeSession: Session | null) {
  if (!activeSession) {
    setState({
      activeDocument: null,
      campaignDocuments: [],
      characterSheets: [],
      activeCharacterSheet: null,
      combatState: null,
      chaosFactor: DEFAULT_CHAOS_FACTOR,
    });
    return;
  }

  const repositories = await createRepositories();
  let loadedActiveSession = activeSession;
  let documents = await repositories.documents.listBySessionId(activeSession.id);

  if (documents.length === 0) {
    const campaignDocument = await repositories.documents.create({
      sessionId: activeSession.id,
      kind: "document",
      title: activeSession.name,
    });
    const updatedSession = await repositories.sessions.update({
      id: activeSession.id,
      documentId: campaignDocument.id,
    });

    loadedActiveSession = updatedSession ?? {
      ...activeSession,
      documentId: campaignDocument.id,
    };
    await repositories.documents.create({
      sessionId: activeSession.id,
      kind: "folder",
      folderKind: "characters",
      title: "Characters",
    });
    await repositories.documents.create({
      sessionId: activeSession.id,
      kind: "folder",
      folderKind: "sessions",
      title: "Sessions",
    });
    documents = await repositories.documents.listBySessionId(activeSession.id);
  }

  let campaignDocument =
    documents.find(
      (document) =>
        document.id === loadedActiveSession.documentId &&
        document.kind === "document" &&
        !document.parentId,
    ) ?? null;

  if (!campaignDocument) {
    campaignDocument = await repositories.documents.create({
      sessionId: loadedActiveSession.id,
      kind: "document",
      title: loadedActiveSession.name,
    });
    const updatedSession = await repositories.sessions.update({
      id: loadedActiveSession.id,
      documentId: campaignDocument.id,
    });

    loadedActiveSession = updatedSession ?? {
      ...loadedActiveSession,
      documentId: campaignDocument.id,
    };
    documents = await repositories.documents.listBySessionId(
      loadedActiveSession.id,
    );
  }

  const document =
    documents.find((candidate) => candidate.id === state.activeDocument?.id) ??
    documents.find((candidate) => candidate.id === loadedActiveSession.documentId) ??
    documents.find((candidate) => candidate.kind !== "folder") ??
    null;
  const loadedSheets = await repositories.characterSheets.listBySessionId(
    loadedActiveSession.id,
  );
  const sheets = loadedSheets.map((sheet) => ({
    ...sheet,
    fields: normalizeCharacterFields(sheet.fields),
  }));
  const charactersFolder = documents.find(
    (document) => document.folderKind === "characters",
  );

  if (charactersFolder) {
    for (const sheet of sheets) {
      const existingCharacterDocument = documents.find(
        (document) => document.characterSheetId === sheet.id,
      );

      if (existingCharacterDocument) {
        continue;
      }

      await repositories.documents.create({
        sessionId: loadedActiveSession.id,
        parentId: charactersFolder.id,
        kind: "character",
        characterSheetId: sheet.id,
        title: sheet.name,
      });
    }

    documents = await repositories.documents.listBySessionId(
      loadedActiveSession.id,
    );
  }

  const activeCharacterSheet =
    sheets.find((sheet) => sheet.id === loadedActiveSession.activeCharacterSheetId) ??
    sheets[0] ??
    null;
  const combatState = await repositories.combat.getBySessionId(
    loadedActiveSession.id,
  );

  setState({
    activeSession: loadedActiveSession,
    activeSessionId: loadedActiveSession.id,
    sessions: state.sessions.map((session) =>
      session.id === loadedActiveSession.id ? loadedActiveSession : session,
    ),
    activeDocument: document,
    campaignDocuments: documents,
    characterSheets: sheets,
    activeCharacterSheet,
    combatState: combatState ? normalizeCombatState(combatState) : null,
    chaosFactor: loadedActiveSession.chaosFactor,
  });
}
