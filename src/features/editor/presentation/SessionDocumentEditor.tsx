import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { slashCommandRegistry, type ExecuteCommand } from "../../commands";
import { DocumentSaveCoordinator } from "../application/DocumentSaveCoordinator";
import { appStore } from "../../../state/appStore";
import { EditableTitle } from "./TitleEditors";
import type { EditorAdapter } from "./EditorAdapter";
import { SlashMenu } from "./SlashMenu";
import {
  commandOptionMatches,
  getEditorDom,
  getSlashMenuState,
  type SlashMenuState,
} from "./slashMenu";

const SAVE_DEBOUNCE_MS = 600;

export function SessionDocumentEditor({
  adapter,
  executeCommand,
  documentId,
  initialMarkdown,
  isCampaignDocument,
  sessionId,
  sessionName,
  supportsSlashCommands,
  title,
}: {
  adapter: EditorAdapter;
  executeCommand: ExecuteCommand;
  documentId: string;
  initialMarkdown: string;
  isCampaignDocument: boolean;
  sessionId?: string;
  sessionName: string;
  supportsSlashCommands: boolean;
  title: string;
}) {
  const saveCoordinator = useMemo(
    () =>
      new DocumentSaveCoordinator(
        ({ documentId: pendingDocumentId, markdown }) =>
          adapter.saveDocument(pendingDocumentId, {
            contentMarkdown: markdown,
          }),
        {
          schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
          cancel: (handle) => window.clearTimeout(handle as number),
        },
        SAVE_DEBOUNCE_MS,
        adapter.markDocumentSavePending,
      ),
    [adapter, documentId],
  );
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [selectedSlashOptionIndex, setSelectedSlashOptionIndex] = useState(0);

  const filteredSlashMenuOptions = useMemo(() => {
    if (!slashMenu || !supportsSlashCommands) {
      return [];
    }

    return slashCommandRegistry
      .list()
      .filter((option) => commandOptionMatches(option, slashMenu.query));
  }, [slashMenu, supportsSlashCommands]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: adapter.extensions({
        executeCommand,
        getChaosFactor: () =>
          appStore.getSnapshot().activeSession?.chaosFactor ?? 5,
        supportsSlashCommands,
      }),
      content: adapter.parseMarkdown(initialMarkdown),
      editorProps: {
        attributes: {
          "aria-label": "Session markdown editor",
        },
      },
      onUpdate: ({ editor: updatedEditor }) => {
        const markdown = adapter.serialize(updatedEditor.getJSON());
        saveCoordinator.request(documentId, markdown);
      },
    },
    [documentId],
  );

  const updateSlashMenu = useCallback(() => {
    setSlashMenu(
      editor && supportsSlashCommands ? getSlashMenuState(editor) : null,
    );
  }, [editor, supportsSlashCommands]);

  const hideSlashMenu = useCallback(() => {
    setSlashMenu(null);
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on("transaction", updateSlashMenu);
    editor.on("selectionUpdate", updateSlashMenu);
    editor.on("focus", updateSlashMenu);
    editor.on("blur", hideSlashMenu);
    updateSlashMenu();

    window.addEventListener("resize", updateSlashMenu);
    window.addEventListener("scroll", updateSlashMenu, true);

    return () => {
      editor.off("transaction", updateSlashMenu);
      editor.off("selectionUpdate", updateSlashMenu);
      editor.off("focus", updateSlashMenu);
      editor.off("blur", hideSlashMenu);
      window.removeEventListener("resize", updateSlashMenu);
      window.removeEventListener("scroll", updateSlashMenu, true);
    };
  }, [editor, hideSlashMenu, updateSlashMenu]);

  useEffect(() => {
    setSelectedSlashOptionIndex(0);
  }, [slashMenu?.query]);

  useEffect(() => {
    if (selectedSlashOptionIndex < filteredSlashMenuOptions.length) {
      return;
    }

    setSelectedSlashOptionIndex(
      Math.max(0, filteredSlashMenuOptions.length - 1),
    );
  }, [filteredSlashMenuOptions.length, selectedSlashOptionIndex]);

  useEffect(() => {
    if (!editor || !supportsSlashCommands) {
      return;
    }

    const mountedEditor = editor;
    let editorDom: HTMLElement | null = null;
    let animationFrameId: number | null = null;

    function handleSlashMenuKeyDown(event: KeyboardEvent) {
      if (!slashMenu) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        hideSlashMenu();
        return;
      }

      if (filteredSlashMenuOptions.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedSlashOptionIndex(
          (currentIndex) =>
            (currentIndex + 1) % filteredSlashMenuOptions.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedSlashOptionIndex(
          (currentIndex) =>
            (currentIndex - 1 + filteredSlashMenuOptions.length) %
            filteredSlashMenuOptions.length,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selectedOption =
          filteredSlashMenuOptions[selectedSlashOptionIndex] ??
          filteredSlashMenuOptions[0];
        insertSlashCommand(selectedOption.commandText ?? selectedOption.prefix);
      }
    }

    function attachKeyDownHandler() {
      editorDom = getEditorDom(mountedEditor);

      if (!editorDom) {
        animationFrameId = window.requestAnimationFrame(attachKeyDownHandler);
        return;
      }

      editorDom.addEventListener("keydown", handleSlashMenuKeyDown, true);
    }

    attachKeyDownHandler();

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      editorDom?.removeEventListener("keydown", handleSlashMenuKeyDown, true);
    };
  }, [
    editor,
    filteredSlashMenuOptions,
    hideSlashMenu,
    selectedSlashOptionIndex,
    slashMenu,
    supportsSlashCommands,
  ]);

  function insertSlashCommand(commandText: string) {
    if (!editor || !slashMenu) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContentAt(
        {
          from: slashMenu.from,
          to: slashMenu.to,
        },
        commandText,
      )
      .run();
    setSlashMenu(null);
  }

  useEffect(() => {
    return () => {
      saveCoordinator.flush();
    };
  }, [saveCoordinator]);

  return (
    <article className="editor-frame" key={documentId}>
      <header className="document-heading">
        <p>{sessionName}</p>
        <EditableTitle
          ariaLabel="Document title"
          onSaveTitle={async (nextTitle) => {
            await adapter.saveDocument(documentId, {
              title: nextTitle,
            });

            if (isCampaignDocument && sessionId) {
              await appStore.renameSession(sessionId, nextTitle);
            }
          }}
          title={title}
        />
      </header>
      <EditorContent className="tiptap-editor" editor={editor} />
      {slashMenu && supportsSlashCommands ? (
        <SlashMenu
          menu={slashMenu}
          options={filteredSlashMenuOptions}
          select={insertSlashCommand}
          selectedIndex={selectedSlashOptionIndex}
        />
      ) : null}
    </article>
  );
}
