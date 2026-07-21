import { useEffect, useMemo, type ReactNode } from "react";
import type {
  CharacterField,
  CharacterTemplateField,
  CharacterTemplateItem,
  CharacterTemplateLayout,
  CurrentMaxNumberValue,
} from "../../../domain/domainTypes";
import {
  createFieldsFromTemplate,
  isTemplateGroup,
  isTemplateLayout,
  isTemplateSeparator,
} from "../../../characterSheets/characterSheetTemplateLogic";
import { appStore, useAppStore } from "../../../state/appStore";
import { EditableTitle } from "./TitleEditors";
import { CharacterFieldInput } from "./CharacterFieldInput";
import { coerceFieldValue, getCurrentMaxValue } from "./characterFieldValues";

export function CharacterDocumentEditor() {
  const { activeCharacterSheet, activeDocument, characterSheetTemplates } =
    useAppStore();

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
      characterSheetTemplates.find(
        (candidate) => candidate.id === templateId,
      ) ?? null;

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

  function findSheetFieldForTemplateField(
    templateField: CharacterTemplateField,
  ) {
    return (
      fieldsByTemplateId.get(templateField.id) ??
      fieldsByName.get(templateField.name.trim().toLocaleLowerCase()) ??
      null
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
                return sheetField ? (
                  <CharacterFieldInput
                    field={sheetField}
                    updateField={updateField}
                    updateCurrentMaxField={updateCurrentMaxField}
                  />
                ) : null;
              })}
            </div>
          </section>
        );
      }

      if (isTemplateLayout(item)) {
        return renderTemplateLayout(item);
      }

      const sheetField = findSheetFieldForTemplateField(item);
      return sheetField ? (
        <CharacterFieldInput
          field={sheetField}
          updateField={updateField}
          updateCurrentMaxField={updateCurrentMaxField}
        />
      ) : null;
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
