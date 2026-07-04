import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  CharacterField,
  CharacterTemplateField,
  CharacterTemplateItem,
  CharacterTemplateLayout,
  CurrentMaxNumberValue,
} from "./characterSheetTypes";
import {
  isTemplateField,
  isTemplateGroup,
  isTemplateLayout,
  isTemplateSeparator,
} from "./characterSheetTemplateLogic";
import { appStore, useAppStore } from "../state/appStore";

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
    return field.value === true ? "Yes" : "No";
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

export function CharacterSheetBuilder() {
  const {
    activeCharacterSheet,
    activeSession,
    characterSheetTemplates,
  } = useAppStore();
  const [renameValue, setRenameValue] = useState("");
  const [nickValue, setNickValue] = useState("");

  useEffect(() => {
    void appStore.loadTemplates();
  }, []);

  useEffect(() => {
    setRenameValue(activeCharacterSheet?.name ?? "");
  }, [activeCharacterSheet?.id, activeCharacterSheet?.name]);

  useEffect(() => {
    setNickValue(activeCharacterSheet?.nick ?? "");
  }, [activeCharacterSheet?.id, activeCharacterSheet?.nick]);

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

  const templateRenderedFieldIds = useMemo(() => {
    const fieldIds = new Set<string>();

    function collect(items: CharacterTemplateItem[]) {
      for (const item of items) {
        if (isTemplateField(item)) {
          const sheetField =
            fieldsByTemplateId.get(item.id) ??
            fieldsByName.get(item.name.trim().toLocaleLowerCase());

          if (sheetField) {
            fieldIds.add(sheetField.id);
          }
          continue;
        }

        if (isTemplateGroup(item)) {
          collect(item.fields);
          continue;
        }

        if (isTemplateLayout(item)) {
          for (const column of item.columns) {
            collect(column.fields);
          }
        }
      }
    }

    collect(activeTemplate?.fields ?? []);
    return fieldIds;
  }, [activeTemplate, fieldsByName, fieldsByTemplateId]);

  const customFields = useMemo(
    () =>
      (activeCharacterSheet?.fields ?? []).filter(
        (field) => !templateRenderedFieldIds.has(field.id),
      ),
    [activeCharacterSheet?.fields, templateRenderedFieldIds],
  );

  async function renameSheet() {
    const nextName = renameValue.trim();

    if (!activeCharacterSheet || !nextName || nextName === activeCharacterSheet.name) {
      return;
    }

    await appStore.saveActiveCharacterSheet({ name: nextName });
  }

  async function saveNick() {
    if (!activeCharacterSheet || nickValue === (activeCharacterSheet.nick ?? "")) {
      return;
    }

    await appStore.saveActiveCharacterSheet({ nick: nickValue });
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

  async function deleteField(fieldId: string) {
    if (!activeCharacterSheet) {
      return;
    }

    await appStore.saveActiveCharacterSheet({
      fields: activeCharacterSheet.fields.filter((field) => field.id !== fieldId),
    });
  }

  function findSheetFieldForTemplateField(templateField: CharacterTemplateField) {
    return (
      fieldsByTemplateId.get(templateField.id) ??
      fieldsByName.get(templateField.name.trim().toLocaleLowerCase()) ??
      null
    );
  }

  function renderField(field: CharacterField, options?: { canDelete?: boolean }) {
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
        {options?.canDelete ? (
          <button
            aria-label={`Delete ${field.name}`}
            className="sheet-field-delete"
            onClick={() => void deleteField(field.id)}
            type="button"
          >
            x
          </button>
        ) : null}
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

  if (!activeSession) {
    return <p className="empty-state">Create a session to use character sheets.</p>;
  }

  return (
    <div className="sheet-builder">
      <div className="sheet-page-header sheet-builder-header">
        <div>
          <p>Character Sheet Builder</p>
          {activeCharacterSheet ? (
            <input
              aria-label="Sheet name"
              className="sheet-title-input"
              onBlur={() => void renameSheet()}
              onChange={(event) => setRenameValue(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              type="text"
              value={renameValue}
            />
          ) : (
            <h2>No Sheet Selected</h2>
          )}
        </div>
        <button
          onClick={() => appStore.setRoute("characterSheets")}
          type="button"
        >
          Back to List
        </button>
      </div>

      {activeCharacterSheet ? (
        <div className="sheet-editor">
          {activeCharacterSheet.templateName ? (
            <p className="sheet-template-note">
              Template: <strong>{activeCharacterSheet.templateName}</strong>
            </p>
          ) : null}
          <label>
            Nick
            <input
              onBlur={() => void saveNick()}
              onChange={(event) => setNickValue(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              placeholder="Optional /stat target"
              type="text"
              value={nickValue}
            />
          </label>
          <div className="sheet-editor-actions">
            <button
              className="danger-button"
              onClick={() => {
                if (window.confirm(`Delete ${activeCharacterSheet.name}?`)) {
                  void appStore.deleteCharacterSheet(activeCharacterSheet.id);
                  appStore.setRoute("characterSheets");
                }
              }}
              type="button"
            >
              Delete Sheet
            </button>
          </div>

          <div className="sheet-field-list">
            {activeCharacterSheet.fields.length === 0 ? (
              <p className="empty-state">No fields yet.</p>
            ) : activeTemplate ? (
              <>
                {renderTemplateItems(activeTemplate.fields)}
                {customFields.length > 0 ? (
                  <section className="sheet-field-group">
                    <h3>Custom Fields</h3>
                    <div className="sheet-field-list">
                      {customFields.map((field) =>
                        renderField(field, { canDelete: true }),
                      )}
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              activeCharacterSheet.fields.map((field) =>
                renderField(field, { canDelete: true }),
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
