import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appStore, useAppStore } from "../state/appStore";
import { InlineResultBlockExtension } from "./extensions/InlineResultBlockExtension";
import { CombatSpaceExtension } from "./extensions/CombatSpaceExtension";
import { CombatTurnBlockExtension } from "./extensions/CombatTurnBlockExtension";
import { ResultBlockExtension } from "./extensions/ResultBlockExtension";
import { SceneContainerExtension } from "./extensions/SceneContainerExtension";
import { SlashCommandExtension } from "./extensions/SlashCommandExtension";
import { markdownToTiptapJson, tiptapJsonToMarkdown } from "./markdown";

const SAVE_DEBOUNCE_MS = 600;

const SLASH_MENU_OPTIONS = [
  { label: "Roll Dice", prefix: "/roll " },
  { label: "Ask Oracle", prefix: "/ask " },
  { label: "Start Scene", prefix: "/scene" },
  { label: "Start Combat", prefix: "/combat" },
  { label: "Modify Stat", prefix: "/stat " },
  { label: "Modify Chaos", prefix: "/chaos " },
] as const;

type SlashMenuState = {
  from: number;
  to: number;
  left: number;
  top: number;
  query: string;
};

function getSlashMenuState(editor: TiptapEditor): SlashMenuState | null {
  const { selection } = editor.state;

  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  const parent = $from.parent;

  if (parent.type.name !== "paragraph") {
    return null;
  }

  const textBeforeCursor = parent.textBetween(0, $from.parentOffset);
  const slashIndex = textBeforeCursor.lastIndexOf("/");

  if (slashIndex < 0) {
    return null;
  }

  if (slashIndex > 0 && !/\s/.test(textBeforeCursor[slashIndex - 1])) {
    return null;
  }

  const slashQuery = textBeforeCursor.slice(slashIndex + 1);

  if (/\s/.test(slashQuery)) {
    return null;
  }

  try {
    const coords = editor.view.coordsAtPos($from.pos);

    return {
      from: $from.start() + slashIndex,
      to: $from.pos,
      left: coords.left,
      top: coords.bottom + 8,
      query: slashQuery.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function commandOptionMatches(
  option: (typeof SLASH_MENU_OPTIONS)[number],
  query: string,
): boolean {
  if (query.length === 0) {
    return true;
  }

  const commandName = option.prefix.slice(1).trim();

  return (
    option.label.toLowerCase().includes(query) ||
    commandName.includes(query)
  );
}

export function Editor() {
  const { activeDocument, activeSession } = useAppStore();

  if (!activeDocument) {
    return (
      <article className="editor-empty-state">
        <p>Create a session to start writing.</p>
      </article>
    );
  }

  return (
    <SessionDocumentEditor
      documentId={activeDocument.id}
      initialMarkdown={activeDocument.contentMarkdown}
      sessionName={activeSession?.name ?? "Session"}
      title={activeDocument.title}
    />
  );
}

function SessionDocumentEditor({
  documentId,
  initialMarkdown,
  sessionName,
  title,
}: {
  documentId: string;
  initialMarkdown: string;
  sessionName: string;
  title: string;
}) {
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<{
    documentId: string;
    markdown: string;
  } | null>(null);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [selectedSlashOptionIndex, setSelectedSlashOptionIndex] = useState(0);

  const filteredSlashMenuOptions = useMemo(() => {
    if (!slashMenu) {
      return [];
    }

    return SLASH_MENU_OPTIONS.filter((option) =>
      commandOptionMatches(option, slashMenu.query),
    );
  }, [slashMenu]);

  function flushPendingSave() {
    if (!pendingSaveRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const pendingSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    void appStore.saveDocument(pendingSave.documentId, {
      contentMarkdown: pendingSave.markdown,
    });
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      CombatTurnBlockExtension,
      CombatSpaceExtension,
      ResultBlockExtension,
      InlineResultBlockExtension,
      SceneContainerExtension,
      SlashCommandExtension,
    ],
    content: markdownToTiptapJson(initialMarkdown),
    editorProps: {
      attributes: {
        "aria-label": "Session markdown editor",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const document = appStore.getSnapshot().activeDocument;

      if (!document) {
        return;
      }

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      const markdown = tiptapJsonToMarkdown(updatedEditor.getJSON());
      const documentId = document.id;
      pendingSaveRef.current = { documentId, markdown };
      appStore.setDocumentSavePending();
      saveTimeoutRef.current = window.setTimeout(() => {
        pendingSaveRef.current = null;
        void appStore.saveDocument(document.id, { contentMarkdown: markdown });
      }, SAVE_DEBOUNCE_MS);
    },
  }, [documentId]);

  const updateSlashMenu = useCallback(() => {
    setSlashMenu(editor ? getSlashMenuState(editor) : null);
  }, [editor]);

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

    setSelectedSlashOptionIndex(Math.max(0, filteredSlashMenuOptions.length - 1));
  }, [filteredSlashMenuOptions.length, selectedSlashOptionIndex]);

  useEffect(() => {
    if (!editor) {
      return;
    }

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
        setSelectedSlashOptionIndex((currentIndex) =>
          (currentIndex + 1) % filteredSlashMenuOptions.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedSlashOptionIndex((currentIndex) =>
          (currentIndex - 1 + filteredSlashMenuOptions.length) %
          filteredSlashMenuOptions.length,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        insertSlashCommand(
          filteredSlashMenuOptions[selectedSlashOptionIndex]?.prefix ??
            filteredSlashMenuOptions[0].prefix,
        );
      }
    }

    editor.view.dom.addEventListener("keydown", handleSlashMenuKeyDown, true);

    return () => {
      editor.view.dom.removeEventListener("keydown", handleSlashMenuKeyDown, true);
    };
  }, [
    editor,
    filteredSlashMenuOptions,
    hideSlashMenu,
    selectedSlashOptionIndex,
    slashMenu,
  ]);

  function insertSlashCommand(prefix: string) {
    if (!editor || !slashMenu) {
      return;
    }

    editor.chain().focus().insertContentAt(
      {
        from: slashMenu.from,
        to: slashMenu.to,
      },
      prefix,
    ).run();
    setSlashMenu(null);
  }

  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, []);

  return (
    <article className="editor-frame" key={documentId}>
      <header className="document-heading">
        <p>{sessionName}</p>
        <h2>{title}</h2>
      </header>
      <EditorContent className="tiptap-editor" editor={editor} />
      {slashMenu ? (
        <div
          aria-label="Slash command menu"
          className="slash-menu"
          role="menu"
          style={{
            left: slashMenu.left,
            top: slashMenu.top,
          }}
        >
          {filteredSlashMenuOptions.length > 0 ? (
            filteredSlashMenuOptions.map((option, optionIndex) => (
              <button
                key={option.prefix}
                aria-selected={optionIndex === selectedSlashOptionIndex}
                className={
                  optionIndex === selectedSlashOptionIndex ? "is-selected" : undefined
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertSlashCommand(option.prefix);
                }}
                role="menuitem"
                type="button"
              >
                <span>{option.label}</span>
                <code>{option.prefix}</code>
              </button>
            ))
          ) : (
            <p className="slash-menu-empty">No commands found</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
