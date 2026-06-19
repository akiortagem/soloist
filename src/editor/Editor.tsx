import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { appStore, useAppStore } from "../state/appStore";
import { InlineResultBlockExtension } from "./extensions/InlineResultBlockExtension";
import { ResultBlockExtension } from "./extensions/ResultBlockExtension";
import { SlashCommandExtension } from "./extensions/SlashCommandExtension";
import { markdownToTiptapJson, tiptapJsonToMarkdown } from "./markdown";

const SAVE_DEBOUNCE_MS = 600;

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
      ResultBlockExtension,
      InlineResultBlockExtension,
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
    </article>
  );
}
