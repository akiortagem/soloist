import type { ExecuteCommand } from "../../commands";
import { appStore, useAppStore } from "../../../state/appStore";
import { CharacterDocumentEditor } from "./CharacterDocumentEditor";
import { SessionDocumentEditor } from "./SessionDocumentEditor";
import { TitleOnlyEditor } from "./TitleEditors";
import type { EditorAdapter } from "./EditorAdapter";

export function Editor({
  adapter,
  executeCommand,
}: {
  adapter: EditorAdapter;
  executeCommand: ExecuteCommand;
}) {
  const { activeDocument, activeSession } = useAppStore();

  if (!activeDocument) {
    if (activeSession) {
      return (
        <TitleOnlyEditor
          eyebrow="Campaign"
          onSaveTitle={(title) =>
            appStore.renameSession(activeSession.id, title)
          }
          title={activeSession.name}
        />
      );
    }
    return (
      <article className="editor-empty-state">
        <p>Create a campaign to start writing.</p>
      </article>
    );
  }

  if (activeDocument.kind === "folder") {
    return (
      <TitleOnlyEditor
        eyebrow={activeSession?.name ?? "Campaign"}
        onSaveTitle={(title) =>
          appStore.saveDocument(activeDocument.id, { title })
        }
        title={activeDocument.title}
      />
    );
  }

  if (activeDocument.kind === "character") return <CharacterDocumentEditor />;

  return (
    <SessionDocumentEditor
      adapter={adapter}
      executeCommand={executeCommand}
      documentId={activeDocument.id}
      initialMarkdown={activeDocument.contentMarkdown}
      isCampaignDocument={activeDocument.id === activeSession?.documentId}
      sessionId={activeSession?.id}
      sessionName={activeSession?.name ?? "Session"}
      supportsSlashCommands={activeDocument.kind === "session"}
      title={activeDocument.title}
    />
  );
}
