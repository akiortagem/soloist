import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CharacterField,
  CharacterTemplateField,
  CharacterTemplateItem,
  CharacterTemplateLayout,
  CurrentMaxNumberValue,
} from "../domain/domainTypes";
import {
  createFieldsFromTemplate,
  isTemplateField,
  isTemplateGroup,
  isTemplateLayout,
  isTemplateSeparator,
} from "../characterSheets/characterSheetTemplateLogic";
import {
  slashCommandRegistry,
  type SlashCommandDefinition,
} from "../commands/slashCommandRegistry";
import { appStore, useAppStore } from "../state/appStore";
import { InlineResultBlockExtension } from "./extensions/InlineResultBlockExtension";
import { CombatSpaceExtension } from "./extensions/CombatSpaceExtension";
import { CombatTurnBlockExtension } from "./extensions/CombatTurnBlockExtension";
import { ResultBlockExtension } from "./extensions/ResultBlockExtension";
import { SceneContainerExtension } from "./extensions/SceneContainerExtension";
import { SlashCommandExtension } from "./extensions/SlashCommandExtension";
import { markdownToTiptapJson, tiptapJsonToMarkdown } from "./markdown";

const SAVE_DEBOUNCE_MS = 600;

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
  option: SlashCommandDefinition,
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

function getEditorDom(editor: TiptapEditor): HTMLElement | null {
  try {
    return editor.view.dom;
  } catch {
    return null;
  }
}

export function Editor() {
  const { activeDocument, activeSession } = useAppStore();

  if (!activeDocument) {
    if (activeSession) {
      return (
        <TitleOnlyEditor
          eyebrow="Campaign"
          onSaveTitle={(title) => appStore.renameSession(activeSession.id, title)}
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

  if (activeDocument.kind === "character") {
    return <CharacterDocumentEditor />;
  }

  return (
    <SessionDocumentEditor
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

function coerceNumberValue(value: string) {
  if (value.trim() === "") {
    return 0;
  }

  const numericValue = Number.parseFloat(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function coerceNonNegativeNumberValue(value: string) {
  return Math.max(0, coerceNumberValue(value));
}

function getCurrentMaxValue(value: CharacterField["value"]): CurrentMaxNumberValue {
  if (value && typeof value === "object") {
    const candidate = value as Partial<CurrentMaxNumberValue>;

    return {
      current:
        typeof candidate.current === "number" &&
        Number.isFinite(candidate.current)
          ? Math.max(0, candidate.current)
          : 0,
      max:
        typeof candidate.max === "number" && Number.isFinite(candidate.max)
          ? Math.max(0, candidate.max)
          : 0,
    };
  }

  return {
    current: 0,
    max: 0,
  };
}

function formatFieldValue(field: CharacterField) {
  if (field.type === "boolean") {
    return field.value === true ? "true" : "false";
  }

  if (field.type === "current_max_number") {
    const value = getCurrentMaxValue(field.value);
    return `${value.current} / ${value.max}`;
  }

  return String(field.value);
}

function coerceFieldValue(field: CharacterField, value: string | boolean) {
  if (field.type === "number") {
    return coerceNumberValue(String(value));
  }

  if (field.type === "boolean") {
    return value === true;
  }

  return String(value);
}

function CharacterDocumentEditor() {
  const {
    activeCharacterSheet,
    activeDocument,
    characterSheetTemplates,
  } = useAppStore();

  useEffect(() => {
    void appStore.loadTemplates();
  }, []);

  const activeTemplate = useMemo(
    () =>
      activeCharacterSheet?.templateId
        ? (characterSheetTemplates.find(
            (template) => template.id === activeCharacterSheet.templateId,
          ) ?? null)
        : null,
    [activeCharacterSheet?.templateId, characterSheetTemplates],
  );

  const fieldsByTemplateId = useMemo(() => {
    const byTemplateId = new Map<string, CharacterField>();

    for (const field of activeCharacterSheet?.fields ?? []) {
      if (field.templateFieldId) {
        byTemplateId.set(field.templateFieldId, field);
      }
    }

    return byTemplateId;
  }, [activeCharacterSheet?.fields]);

  const fieldsByName = useMemo(() => {
    const byName = new Map<string, CharacterField>();

    for (const field of activeCharacterSheet?.fields ?? []) {
      byName.set(field.name.trim().toLocaleLowerCase(), field);
    }

    return byName;
  }, [activeCharacterSheet?.fields]);

  if (!activeDocument || !activeCharacterSheet) {
    return (
      <article className="editor-empty-state">
        <p>Select a character to edit it.</p>
      </article>
    );
  }

  async function chooseTemplate(templateId: string) {
    if (!activeCharacterSheet) {
      return;
    }

    const template =
      characterSheetTemplates.find((candidate) => candidate.id === templateId) ??
      null;

    if (!template) {
      return;
    }

    await appStore.saveActiveCharacterSheet({
      templateId: template.id,
      templateName: template.name,
      fields: createFieldsFromTemplate(template.fields),
    });
  }

  async function updateField(field: CharacterField, value: string | boolean) {
    if (!activeCharacterSheet) {
      return;
    }

    await appStore.saveActiveCharacterSheet({
      fields: activeCharacterSheet.fields.map((candidate) =>
        candidate.id === field.id
          ? { ...candidate, value: coerceFieldValue(field, value) }
          : candidate,
      ),
    });
  }

  async function updateCurrentMaxField(
    field: CharacterField,
    patch: Partial<CurrentMaxNumberValue>,
  ) {
    if (!activeCharacterSheet) {
      return;
    }

    const currentValue = getCurrentMaxValue(field.value);

    await appStore.saveActiveCharacterSheet({
      fields: activeCharacterSheet.fields.map((candidate) =>
        candidate.id === field.id
          ? {
              ...candidate,
              value: {
                current: patch.current ?? currentValue.current,
                max: patch.max ?? currentValue.max,
              },
            }
          : candidate,
      ),
    });
  }

  function findSheetFieldForTemplateField(templateField: CharacterTemplateField) {
    return (
      fieldsByTemplateId.get(templateField.id) ??
      fieldsByName.get(templateField.name.trim().toLocaleLowerCase()) ??
      null
    );
  }

  function renderField(field: CharacterField) {
    const currentMaxValue =
      field.type === "current_max_number" ? getCurrentMaxValue(field.value) : null;

    return (
      <div className="sheet-field-row" key={field.id}>
        <label>
          {field.name}
          {field.type === "boolean" ? (
            <input
              checked={field.value === true}
              onChange={(event) =>
                void updateField(field, event.currentTarget.checked)
              }
              type="checkbox"
            />
          ) : field.type === "longText" ? (
            <textarea
              onChange={(event) =>
                void updateField(field, event.currentTarget.value)
              }
              rows={3}
              value={formatFieldValue(field)}
            />
          ) : field.type === "current_max_number" && currentMaxValue ? (
            <div className="sheet-current-max-field">
              <input
                aria-label={`${field.name} current value`}
                min={0}
                onChange={(event) =>
                  void updateCurrentMaxField(field, {
                    current: coerceNonNegativeNumberValue(
                      event.currentTarget.value,
                    ),
                  })
                }
                type="number"
                value={currentMaxValue.current}
              />
              <span>/</span>
              <input
                aria-label={`${field.name} maximum value`}
                min={0}
                onChange={(event) =>
                  void updateCurrentMaxField(field, {
                    max: coerceNonNegativeNumberValue(event.currentTarget.value),
                  })
                }
                type="number"
                value={currentMaxValue.max}
              />
            </div>
          ) : (
            <input
              max={field.maxValue}
              min={field.minValue}
              onChange={(event) =>
                void updateField(field, event.currentTarget.value)
              }
              type={field.type === "number" ? "number" : "text"}
              value={formatFieldValue(field)}
            />
          )}
        </label>
      </div>
    );
  }

  function renderTemplateItems(items: CharacterTemplateItem[]): ReactNode {
    return items.map((item) => {
      if (isTemplateSeparator(item)) {
        return (
          <div className="sheet-template-separator" key={item.id}>
            <hr />
            {item.label ? <span>{item.label}</span> : null}
          </div>
        );
      }

      if (isTemplateGroup(item)) {
        return (
          <section className="sheet-field-group" key={item.id}>
            <h3>{item.name}</h3>
            <div className="sheet-field-list">
              {item.fields.map((field) => {
                const sheetField = findSheetFieldForTemplateField(field);
                return sheetField ? renderField(sheetField) : null;
              })}
            </div>
          </section>
        );
      }

      if (isTemplateLayout(item)) {
        return renderTemplateLayout(item);
      }

      const sheetField = findSheetFieldForTemplateField(item);
      return sheetField ? renderField(sheetField) : null;
    });
  }

  function renderTemplateLayout(layout: CharacterTemplateLayout) {
    return (
      <div
        className="sheet-template-layout"
        key={layout.id}
        style={{
          gridTemplateColumns: `repeat(${layout.columns.length}, minmax(0, 1fr))`,
        }}
      >
        {layout.columns.map((column) => (
          <div className="sheet-template-column" key={column.id}>
            {renderTemplateItems(column.fields)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <article className="editor-frame">
      <header className="document-heading">
        <p>Character</p>
        <EditableTitle
          ariaLabel="Character name"
          onSaveTitle={async (nextTitle) => {
            await appStore.saveDocument(activeDocument.id, {
              title: nextTitle,
            });
          }}
          title={activeDocument.title}
        />
      </header>

      <div className="sheet-editor">
        <label className="character-nick-field">
          Nick
          <input
            onBlur={(event) =>
              void appStore.saveActiveCharacterSheet({
                nick: event.currentTarget.value,
              })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            placeholder="Optional /stat target"
            type="text"
            defaultValue={activeCharacterSheet.nick ?? ""}
            key={activeCharacterSheet.id}
          />
        </label>

        {!activeCharacterSheet.templateId ? (
          <label className="character-template-choice">
            Template
            {characterSheetTemplates.length > 0 ? (
              <select
                onChange={(event) => {
                  if (event.currentTarget.value) {
                    void chooseTemplate(event.currentTarget.value);
                  }
                }}
                value=""
              >
                <option value="">Choose template</option>
                {characterSheetTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="empty-state">No templates available.</p>
            )}
          </label>
        ) : (
          <p className="sheet-template-note">
            Template: <strong>{activeCharacterSheet.templateName}</strong>
          </p>
        )}

        {activeTemplate ? (
          <div className="sheet-field-list">
            {renderTemplateItems(activeTemplate.fields)}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function EditableTitle({
  ariaLabel,
  onSaveTitle,
  title,
}: {
  ariaLabel: string;
  onSaveTitle: (title: string) => Promise<unknown>;
  title: string;
}) {
  const [draftTitle, setDraftTitle] = useState(title);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  async function saveTitle() {
    const nextTitle = draftTitle.trim() || "Untitled";

    setDraftTitle(nextTitle);

    if (nextTitle !== title) {
      await onSaveTitle(nextTitle);
    }
  }

  return (
    <input
      aria-label={ariaLabel}
      className="document-title-input"
      onBlur={() => void saveTitle()}
      onChange={(event) => setDraftTitle(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      type="text"
      value={draftTitle}
    />
  );
}

function TitleOnlyEditor({
  eyebrow,
  onSaveTitle,
  title,
}: {
  eyebrow: string;
  onSaveTitle: (title: string) => Promise<unknown>;
  title: string;
}) {
  return (
    <article className="editor-frame">
      <header className="document-heading">
        <p>{eyebrow}</p>
        <EditableTitle
          ariaLabel="Document title"
          onSaveTitle={onSaveTitle}
          title={title}
        />
      </header>
      <p className="editor-title-only-note">
        Create or select a document to edit markdown content.
      </p>
    </article>
  );
}

function SessionDocumentEditor({
  documentId,
  initialMarkdown,
  isCampaignDocument,
  sessionId,
  sessionName,
  supportsSlashCommands,
  title,
}: {
  documentId: string;
  initialMarkdown: string;
  isCampaignDocument: boolean;
  sessionId?: string;
  sessionName: string;
  supportsSlashCommands: boolean;
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
    if (!slashMenu || !supportsSlashCommands) {
      return [];
    }

    return slashCommandRegistry.list().filter((option) =>
      commandOptionMatches(option, slashMenu.query),
    );
  }, [slashMenu, supportsSlashCommands]);

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
    extensions: supportsSlashCommands
      ? [
          StarterKit,
          CombatTurnBlockExtension,
          CombatSpaceExtension,
          ResultBlockExtension,
          InlineResultBlockExtension,
          SceneContainerExtension,
          SlashCommandExtension,
        ]
      : [StarterKit],
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
    setSlashMenu(editor && supportsSlashCommands ? getSlashMenuState(editor) : null);
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

    setSelectedSlashOptionIndex(Math.max(0, filteredSlashMenuOptions.length - 1));
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
        <EditableTitle
          ariaLabel="Document title"
          onSaveTitle={async (nextTitle) => {
            await appStore.saveDocument(documentId, {
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
                key={option.id}
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
