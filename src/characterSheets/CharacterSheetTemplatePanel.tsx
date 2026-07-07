import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Download } from "lucide-react";
import {
  CHARACTER_TEMPLATE_FIELD_TYPES,
  coerceTemplateFieldDefaultValue,
  createTemplateField,
  createTemplateGroup,
  createTemplateLayout,
  createTemplateLayoutColumn,
  createTemplateSeparator,
  isTemplateField,
  isTemplateGroup,
  isTemplateLayout,
  isTemplateSeparator,
} from "./characterSheetTemplateLogic";
import type {
  CharacterSheetTemplate,
  CharacterTemplateField,
  CharacterTemplateGroup,
  CharacterTemplateItem,
  CharacterTemplateLayout,
  CurrentMaxNumberValue,
} from "./characterSheetTypes";
import {
  createCharacterSheetTemplatePluginManifest,
  createPluginManifestFileName,
} from "../plugins/characterSheetTemplateExporter";
import { appStore, useAppStore } from "../state/appStore";

type TemplateView = "list" | "edit";

function parseOptionalNumber(value: string) {
  if (value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCurrentMaxDefaultValue(
  value: CharacterTemplateField["defaultValue"],
): CurrentMaxNumberValue {
  const coercedValue = coerceTemplateFieldDefaultValue(
    "current_max_number",
    value,
  );

  return coercedValue as CurrentMaxNumberValue;
}

function renderTemplateFieldInput(field: CharacterTemplateField) {
  if (field.type === "number") {
    return (
      <input
        aria-label={`${field.name} default value`}
        defaultValue={String(field.defaultValue)}
        max={field.maxValue}
        min={field.minValue}
        readOnly
        type="number"
      />
    );
  }

  if (field.type === "current_max_number") {
    const defaultValue = getCurrentMaxDefaultValue(field.defaultValue);

    return (
      <div className="sheet-current-max-field template-current-max-field">
        <input
          aria-label={`${field.name} current default value`}
          defaultValue={String(defaultValue.current)}
          min={0}
          readOnly
          type="number"
        />
        <span>/</span>
        <input
          aria-label={`${field.name} maximum default value`}
          defaultValue={String(defaultValue.max)}
          min={0}
          readOnly
          type="number"
        />
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="template-checkbox">
        <input
          checked={field.defaultValue === true}
          aria-label={`${field.name} default value`}
          readOnly
          type="checkbox"
        />
        Enabled by default
      </label>
    );
  }

  if (field.type === "longText") {
    return (
      <textarea
        aria-label={`${field.name} default value`}
        defaultValue={String(field.defaultValue)}
        readOnly
        rows={3}
      />
    );
  }

  return (
    <input
      aria-label={`${field.name} default value`}
      defaultValue={String(field.defaultValue)}
      readOnly
      type="text"
    />
  );
}

function countTemplateFields(items: CharacterTemplateItem[]): number {
  return items.reduce((count, item) => {
    if (isTemplateGroup(item)) {
      return count + item.fields.length;
    }

    if (isTemplateLayout(item)) {
      return (
        count +
        item.columns.reduce(
          (columnCount, column) =>
            columnCount + countTemplateFields(column.fields),
          0,
        )
      );
    }

    return count + (isTemplateField(item) ? 1 : 0);
  }, 0);
}

function ActionMenu({
  onDelete,
  onEdit,
}: {
  onDelete: () => void;
  onEdit?: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  return (
    <div className="template-item-actions" ref={menuRef}>
      <button
        aria-expanded={isMenuOpen}
        aria-label="Field actions"
        className="template-kebab-button"
        onClick={() => setIsMenuOpen((current) => !current)}
        type="button"
      >
        ...
      </button>
      {isMenuOpen ? (
        <div className="template-item-menu">
          {onEdit ? (
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onEdit();
              }}
              type="button"
            >
              Modify
            </button>
          ) : null}
          <button
            onClick={() => {
              setIsMenuOpen(false);
              onDelete();
            }}
            type="button"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TemplateList({
  installedPluginIds,
  onCreate,
  onEdit,
  onExport,
  onReinstall,
  templates,
}: {
  installedPluginIds: Set<string>;
  onCreate: () => void;
  onEdit: (template: CharacterSheetTemplate) => void;
  onExport: (template: CharacterSheetTemplate) => void;
  onReinstall: (template: CharacterSheetTemplate) => void;
  templates: CharacterSheetTemplate[];
}) {
  return (
    <div className="template-screen">
      <div className="template-screen-header">
        <div>
          <p>Character Sheet Templates</p>
          <h2>Templates</h2>
        </div>
        <button onClick={onCreate} type="button">
          New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="empty-state">
          No templates yet. Create one to define reusable character sheet fields.
        </p>
      ) : (
        <div className="template-list">
          {templates.map((template) => {
            const fieldCount = countTemplateFields(template.fields);
            const groupCount = template.fields.filter(isTemplateGroup).length;
            const layoutCount = template.fields.filter(isTemplateLayout).length;
            const separatorCount =
              template.fields.filter(isTemplateSeparator).length;

            return (
              <article className="template-list-item" key={template.id}>
                <div>
                  <h3>{template.name}</h3>
                  <p>
                    {fieldCount} field{fieldCount === 1 ? "" : "s"}
                    {groupCount > 0
                      ? `, ${groupCount} group${groupCount === 1 ? "" : "s"}`
                      : ""}
                    {layoutCount > 0
                      ? `, ${layoutCount} row${layoutCount === 1 ? "" : "s"}`
                      : ""}
                    {separatorCount > 0
                      ? `, ${separatorCount} separator${
                          separatorCount === 1 ? "" : "s"
                        }`
                      : ""}
                  </p>
                </div>
                <div className="template-header-actions">
                  <button
                    onClick={() => onExport(template)}
                    title="Export as a plugin manifest"
                    type="button"
                  >
                    <Download aria-hidden="true" />
                    Export
                  </button>
                  {template.sourcePluginId &&
                  template.sourceContributionId &&
                  installedPluginIds.has(template.sourcePluginId) ? (
                    <button
                      onClick={() => onReinstall(template)}
                      title="Create a fresh editable copy from the plugin contribution"
                      type="button"
                    >
                      Reinstall
                    </button>
                  ) : null}
                  <button onClick={() => onEdit(template)} type="button">
                    Edit
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  onChange,
}: {
  field: CharacterTemplateField;
  onChange: (field: CharacterTemplateField) => void;
}) {
  return (
    <div className="template-item-editor">
      <label>
        Field name
        <input
          onChange={(event) =>
            onChange({ ...field, name: event.currentTarget.value })
          }
          type="text"
          value={field.name}
        />
      </label>

      <label>
        Type
        <select
          onChange={(event) => {
            const type = event.currentTarget
              .value as CharacterTemplateField["type"];
            onChange({
              ...field,
              type,
              defaultValue: coerceTemplateFieldDefaultValue(
                type,
                field.defaultValue,
              ),
              minValue: type === "number" ? field.minValue : undefined,
              maxValue: type === "number" ? field.maxValue : undefined,
            });
          }}
          value={field.type}
        >
          {CHARACTER_TEMPLATE_FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {field.type === "number" ? (
        <>
          <label>
            Default
            <input
              onChange={(event) =>
                onChange({
                  ...field,
                  defaultValue: coerceTemplateFieldDefaultValue(
                    "number",
                    event.currentTarget.value,
                  ),
                })
              }
              type="number"
              value={String(field.defaultValue)}
            />
          </label>
          <label>
            Min
            <input
              onChange={(event) =>
                onChange({
                  ...field,
                  minValue: parseOptionalNumber(event.currentTarget.value),
                })
              }
              type="number"
              value={field.minValue ?? ""}
            />
          </label>
          <label>
            Max
            <input
              onChange={(event) =>
                onChange({
                  ...field,
                  maxValue: parseOptionalNumber(event.currentTarget.value),
                })
              }
              type="number"
              value={field.maxValue ?? ""}
            />
          </label>
        </>
      ) : null}

      {field.type === "current_max_number" ? (
        <>
          <label>
            Current default
            <input
              min={0}
              onChange={(event) =>
                onChange({
                  ...field,
                  defaultValue: {
                    ...getCurrentMaxDefaultValue(field.defaultValue),
                    current: Math.max(
                      0,
                      Number.parseFloat(event.currentTarget.value) || 0,
                    ),
                  },
                })
              }
              type="number"
              value={String(
                getCurrentMaxDefaultValue(field.defaultValue).current,
              )}
            />
          </label>
          <label>
            Max default
            <input
              min={0}
              onChange={(event) =>
                onChange({
                  ...field,
                  defaultValue: {
                    ...getCurrentMaxDefaultValue(field.defaultValue),
                    max: Math.max(
                      0,
                      Number.parseFloat(event.currentTarget.value) || 0,
                    ),
                  },
                })
              }
              type="number"
              value={String(getCurrentMaxDefaultValue(field.defaultValue).max)}
            />
          </label>
        </>
      ) : null}

      {field.type === "boolean" ? (
        <label className="template-checkbox">
          <input
            checked={field.defaultValue === true}
            onChange={(event) =>
              onChange({ ...field, defaultValue: event.currentTarget.checked })
            }
            type="checkbox"
          />
          Checked by default
        </label>
      ) : null}

      {field.type === "text" ? (
        <label>
          Default
          <input
            onChange={(event) =>
              onChange({ ...field, defaultValue: event.currentTarget.value })
            }
            type="text"
            value={String(field.defaultValue)}
          />
        </label>
      ) : null}

      {field.type === "longText" ? (
        <label className="template-full-width">
          Default
          <textarea
            onChange={(event) =>
              onChange({ ...field, defaultValue: event.currentTarget.value })
            }
            rows={4}
            value={String(field.defaultValue)}
          />
        </label>
      ) : null}
    </div>
  );
}

function GroupEditor({
  group,
  onChange,
}: {
  group: CharacterTemplateGroup;
  onChange: (group: CharacterTemplateGroup) => void;
}) {
  return (
    <div className="template-item-editor">
      <label>
        Group name
        <input
          onChange={(event) =>
            onChange({ ...group, name: event.currentTarget.value })
          }
          type="text"
          value={group.name}
        />
      </label>
    </div>
  );
}

function LayoutEditor({
  layout,
  onChange,
}: {
  layout: CharacterTemplateLayout;
  onChange: (layout: CharacterTemplateLayout) => void;
}) {
  return (
    <div className="template-item-editor">
      <label>
        Columns
        <select
          onChange={(event) => {
            const columnCount = Number.parseInt(event.currentTarget.value, 10);
            const nextColumns = Array.from({ length: columnCount }, (_, index) =>
              layout.columns[index] ?? createTemplateLayoutColumn(),
            );

            onChange({ ...layout, columns: nextColumns });
          }}
          value={layout.columns.length}
        >
          {[1, 2, 3, 4].map((columnCount) => (
            <option key={columnCount} value={columnCount}>
              {columnCount}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function TemplateItemRow({
  children,
  isEditing,
  item,
  onDelete,
  onEdit,
}: {
  children?: ReactNode;
  isEditing: boolean;
  item: CharacterTemplateItem;
  onDelete: () => void;
  onEdit: () => void;
}) {
  if (isTemplateSeparator(item)) {
    return (
      <div
        className={`template-form-card template-separator-card${
          isEditing ? " is-editing" : ""
        }`}
      >
        <div className="template-separator-row">
          <hr />
          <ActionMenu onDelete={onDelete} />
        </div>
      </div>
    );
  }

  if (isTemplateGroup(item)) {
    return (
      <div
        className={`template-form-card template-group-card${
          isEditing ? " is-editing" : ""
        }`}
      >
        <div className="template-group-header">
          <div>
            <h3>{item.name}</h3>
          </div>
          <ActionMenu onDelete={onDelete} onEdit={onEdit} />
        </div>
        {children}
      </div>
    );
  }

  if (isTemplateLayout(item)) {
    return (
      <div
        className={`template-form-card template-layout-card${
          isEditing ? " is-editing" : ""
        }`}
      >
        <div className="template-group-header">
          <div />
          <ActionMenu onDelete={onDelete} onEdit={onEdit} />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={`template-form-card${isEditing ? " is-editing" : ""}`}>
      <div className="template-field-row">
        <div className="template-field-main">
          <div className="template-field-heading">
            <strong>{item.name}</strong>
            <span>{item.type}</span>
        </div>
        {renderTemplateFieldInput(item)}
      </div>
        <ActionMenu onDelete={onDelete} onEdit={onEdit} />
      </div>
      {isEditing ? <div className="template-card-editor">{children}</div> : null}
    </div>
  );
}

function TemplateEditor({
  onBack,
  template,
}: {
  onBack: () => void;
  template: CharacterSheetTemplate;
}) {
  const { isSavingTemplate } = useAppStore();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [fields, setFields] = useState<CharacterTemplateItem[]>(
    () => template.fields,
  );
  const [name, setName] = useState(template.name);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);

  useEffect(() => {
    setEditingItemId(null);
    setFields(template.fields);
    setName(template.name);
    setSelectedColumnId(null);
  }, [template]);

  function findItem(
    items: CharacterTemplateItem[],
    itemId?: string | null,
  ): CharacterTemplateItem | null {
    if (!itemId) {
      return null;
    }

    for (const item of items) {
      if (item.id === itemId) {
        return item;
      }

      if (isTemplateGroup(item)) {
        const groupField = item.fields.find((field) => field.id === itemId);

        if (groupField) {
          return groupField;
        }
      }

      if (isTemplateLayout(item)) {
        const layoutItem: CharacterTemplateItem | null = findItem(
          item.columns.flatMap((column) => column.fields),
          itemId,
        );

        if (layoutItem) {
          return layoutItem;
        }
      }
    }

    return null;
  }

  const editingItem = useMemo(
    () => findItem(fields, editingItemId),
    [editingItemId, fields],
  );

  function updateItems(
    items: CharacterTemplateItem[],
    nextItem: CharacterTemplateItem,
  ): CharacterTemplateItem[] {
    return items.map((item) => {
      if (item.id === nextItem.id) {
        return nextItem;
      }

      if (isTemplateGroup(item) && isTemplateField(nextItem)) {
        return {
          ...item,
          fields: item.fields.map((field) =>
            field.id === nextItem.id ? nextItem : field,
          ),
        };
      }

      if (isTemplateLayout(item)) {
        return {
          ...item,
          columns: item.columns.map((column) => ({
            ...column,
            fields: updateItems(column.fields, nextItem),
          })),
        };
      }

      return item;
    });
  }

  function replaceItem(nextItem: CharacterTemplateItem) {
    setFields((currentFields) => updateItems(currentFields, nextItem));
  }

  function addFieldToGroup(groupId: string) {
    const field = createTemplateField();

    function addToGroup(items: CharacterTemplateItem[]): CharacterTemplateItem[] {
      return items.map((item) => {
        if (isTemplateGroup(item) && item.id === groupId) {
          return { ...item, fields: [...item.fields, field] };
        }

        if (isTemplateLayout(item)) {
          return {
            ...item,
            columns: item.columns.map((column) => ({
              ...column,
              fields: addToGroup(column.fields),
            })),
          };
        }

        return item;
      });
    }

    setFields((currentFields) => addToGroup(currentFields));
    setEditingItemId(field.id);
  }

  function addFieldToLayoutColumn(layoutId: string, columnId: string) {
    const field = createTemplateField();

    setFields((currentFields) =>
      currentFields.map((item) =>
        isTemplateLayout(item) && item.id === layoutId
          ? {
              ...item,
              columns: item.columns.map((column) =>
                column.id === columnId
                  ? { ...column, fields: [...column.fields, field] }
                  : column,
              ),
            }
          : item,
      ),
    );
    setEditingItemId(field.id);
  }

  function insertItem(nextItem: CharacterTemplateItem) {
    if (!selectedColumnId) {
      setFields((currentFields) => [...currentFields, nextItem]);
      setEditingItemId(isTemplateSeparator(nextItem) ? null : nextItem.id);
      return;
    }

    function insertIntoColumn(
      items: CharacterTemplateItem[],
    ): CharacterTemplateItem[] {
      return items.map((item) => {
        if (!isTemplateLayout(item)) {
          return item;
        }

        return {
          ...item,
          columns: item.columns.map((column) => ({
            ...column,
            fields:
              column.id === selectedColumnId
                ? [...column.fields, nextItem]
                : insertIntoColumn(column.fields),
          })),
        };
      });
    }

    setFields((currentFields) => insertIntoColumn(currentFields));
    setEditingItemId(isTemplateSeparator(nextItem) ? null : nextItem.id);
  }

  function deleteFromItems(
    items: CharacterTemplateItem[],
    itemId: string,
  ): CharacterTemplateItem[] {
    return items
      .filter((item) => item.id !== itemId)
      .map((item) => {
        if (isTemplateGroup(item)) {
          return {
            ...item,
            fields: item.fields.filter((field) => field.id !== itemId),
          };
        }

        if (isTemplateLayout(item)) {
          return {
            ...item,
            columns: item.columns.map((column) => ({
              ...column,
              fields: deleteFromItems(column.fields, itemId),
            })),
          };
        }

        return item;
      });
  }

  function deleteItem(itemId: string) {
    setFields((currentFields) => deleteFromItems(currentFields, itemId));
    setEditingItemId((currentId) => (currentId === itemId ? null : currentId));
  }

  async function saveTemplate() {
    const saved = await appStore.saveTemplate({
      id: template.id,
      name,
      fields,
    });

    if (saved) {
      setFields(saved.fields);
      setName(saved.name);
      setEditingItemId(null);
    }
  }

  function renderFieldCard(field: CharacterTemplateField) {
    const isFieldEditing = editingItem?.id === field.id;

    return (
      <div
        className={`template-group-field-card${
          isFieldEditing ? " is-editing" : ""
        }`}
        key={field.id}
      >
        <div className="template-field-row">
          <div className="template-field-main">
            <div className="template-field-heading">
              <strong>{field.name}</strong>
              <span>{field.type}</span>
            </div>
            {renderTemplateFieldInput(field)}
          </div>
          <ActionMenu
            onDelete={() => deleteItem(field.id)}
            onEdit={() => setEditingItemId(field.id)}
          />
        </div>
        {isFieldEditing ? (
          <div className="template-card-editor">
            <div className="template-card-editor-header">
              <h3>Field settings</h3>
              <button
                aria-label="Done"
                onClick={() => setEditingItemId(null)}
                title="Done"
                type="button"
              >
                ✓
              </button>
            </div>
            <FieldEditor field={field} onChange={replaceItem} />
          </div>
        ) : null}
      </div>
    );
  }

  function renderGroupBlock(group: CharacterTemplateGroup) {
    const isGroupEditing = editingItem?.id === group.id;

    return (
      <div
        className={`template-group-card template-column-group${
          isGroupEditing ? " is-editing" : ""
        }`}
        key={group.id}
      >
        <div className="template-group-header">
          <div>
            <h3>{group.name}</h3>
          </div>
          <ActionMenu
            onDelete={() => deleteItem(group.id)}
            onEdit={() => setEditingItemId(group.id)}
          />
        </div>
        <div className="template-group-fields">
          {group.fields.length === 0 ? (
            <p className="empty-state">This group has no fields yet.</p>
          ) : (
            group.fields.map(renderFieldCard)
          )}
        </div>
        <div className="template-group-footer">
          <button
            aria-label="Add field to group"
            onClick={(event) => {
              event.stopPropagation();
              addFieldToGroup(group.id);
            }}
            title="Add field to group"
            type="button"
          >
            +
          </button>
        </div>
        {isGroupEditing ? (
          <div className="template-card-editor">
            <div className="template-card-editor-header">
              <h3>Group settings</h3>
              <button
                aria-label="Done"
                onClick={() => setEditingItemId(null)}
                title="Done"
                type="button"
              >
                ✓
              </button>
            </div>
            <GroupEditor group={group} onChange={replaceItem} />
          </div>
        ) : null}
      </div>
    );
  }

  function renderColumnItem(item: CharacterTemplateItem): ReactNode {
    if (isTemplateSeparator(item)) {
      return (
        <div className="template-separator-row" key={item.id}>
          <hr />
          <ActionMenu onDelete={() => deleteItem(item.id)} />
        </div>
      );
    }

    if (isTemplateGroup(item)) {
      return renderGroupBlock(item);
    }

    if (isTemplateLayout(item)) {
      return (
        <div className="template-nested-layout" key={item.id}>
          <div className="template-layout-inline-header">
            <span />
            <ActionMenu
              onDelete={() => deleteItem(item.id)}
              onEdit={() => setEditingItemId(item.id)}
            />
          </div>
          {renderLayoutColumns(item)}
        </div>
      );
    }

    return renderFieldCard(item);
  }

  function renderLayoutColumns(layout: CharacterTemplateLayout) {
    const isLayoutEditing = editingItem?.id === layout.id;

    return (
      <>
        <div
          className="template-layout-columns"
          style={{
            gridTemplateColumns: `repeat(${layout.columns.length}, minmax(0, 1fr))`,
          }}
        >
          {layout.columns.map((column) => (
            <div
              className={`template-layout-column${
                selectedColumnId === column.id ? " is-selected" : ""
              }`}
              key={column.id}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedColumnId(column.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.stopPropagation();
                  setSelectedColumnId(column.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="template-layout-column-header">
                <span />
              </div>
              {column.fields.length === 0 ? (
                <p className="empty-state">Select to add items.</p>
              ) : (
                column.fields.map(renderColumnItem)
              )}
            </div>
          ))}
        </div>
        {isLayoutEditing ? (
          <div className="template-card-editor">
            <div className="template-card-editor-header">
              <h3>Row settings</h3>
              <button
                aria-label="Done"
                onClick={() => setEditingItemId(null)}
                title="Done"
                type="button"
              >
                ✓
              </button>
            </div>
            <LayoutEditor layout={layout} onChange={replaceItem} />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="template-screen">
      <div className="template-screen-header">
        <div>
          <p>Template Editor</p>
          <h2>{template.name}</h2>
        </div>
        <div className="template-header-actions">
          <button onClick={onBack} type="button">
            Back
          </button>
          <button
            disabled={isSavingTemplate}
            onClick={() => void saveTemplate()}
            type="button"
          >
            {isSavingTemplate ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>

      <div className="template-form-layout">
        <section className="template-form-canvas" aria-label="Template form">
          <div className="template-title-card">
            <label>
              Template name
              <input
                onChange={(event) => setName(event.currentTarget.value)}
                type="text"
                value={name}
              />
            </label>
          </div>

          {fields.length === 0 ? (
            <div className="template-form-card template-empty-card">
              <p className="empty-state">This template has no fields yet.</p>
            </div>
          ) : (
            <div className="template-field-list">
              {fields.map((item) => {
                const isEditing = editingItem?.id === item.id;

                return (
                      <TemplateItemRow
                        isEditing={isEditing}
                        item={item}
                        key={item.id}
                        onDelete={() => deleteItem(item.id)}
                        onEdit={() => setEditingItemId(item.id)}
                      >
                        {isTemplateLayout(item) ? (
                          <>{renderLayoutColumns(item)}</>
                        ) : isTemplateGroup(item) ? (
                          <>
                            <div className="template-group-fields">
                              {item.fields.length === 0 ? (
                                <p className="empty-state">
                                  This group has no fields yet.
                                </p>
                              ) : (
                                item.fields.map((field) => {
                                  const isFieldEditing =
                                    editingItem?.id === field.id;

                                  return (
                                    <div
                                      className={`template-group-field-card${
                                        isFieldEditing ? " is-editing" : ""
                                      }`}
                                      key={field.id}
                                    >
                                      <div className="template-field-row">
                                        <div className="template-field-main">
                                          <div className="template-field-heading">
                                            <strong>{field.name}</strong>
                                            <span>{field.type}</span>
                                          </div>
                                          {renderTemplateFieldInput(field)}
                                        </div>
                                        <ActionMenu
                                          onDelete={() => deleteItem(field.id)}
                                          onEdit={() =>
                                            setEditingItemId(field.id)
                                          }
                                        />
                                      </div>
                                      {isFieldEditing ? (
                                        <div className="template-card-editor">
                                          <div className="template-card-editor-header">
                                            <h3>Field settings</h3>
                                            <button
                                              aria-label="Done"
                                              onClick={() =>
                                                setEditingItemId(null)
                                              }
                                              title="Done"
                                              type="button"
                                            >
                                              ✓
                                            </button>
                                          </div>
                                          <FieldEditor
                                            field={field}
                                            onChange={replaceItem}
                                          />
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            <div className="template-group-footer">
                              <button
                                aria-label="Add field to group"
                                onClick={() => addFieldToGroup(item.id)}
                                title="Add field to group"
                                type="button"
                              >
                                +
                              </button>
                            </div>
                            {isEditing ? (
                              <div className="template-card-editor">
                                <div className="template-card-editor-header">
                                  <h3>Group settings</h3>
                                  <button
                                    aria-label="Done"
                                    onClick={() => setEditingItemId(null)}
                                    title="Done"
                                    type="button"
                                  >
                                    ✓
                                  </button>
                                </div>
                                <GroupEditor group={item} onChange={replaceItem} />
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            {!isTemplateSeparator(item) ? (
                              <>
                                <div className="template-card-editor-header">
                                  <h3>Field settings</h3>
                                  <button
                                    aria-label="Done"
                                    onClick={() => setEditingItemId(null)}
                                    title="Done"
                                    type="button"
                                  >
                                    ✓
                                  </button>
                                </div>
                                <FieldEditor
                                  field={item}
                                  onChange={replaceItem}
                                />
                              </>
                            ) : null}
                          </>
                        )}
                      </TemplateItemRow>
                    );
                  })}
            </div>
          )}
        </section>

        <aside className="template-form-rail" aria-label="Add template items">
          <button
            title="Add field"
            onClick={() => {
              insertItem(createTemplateField());
            }}
            type="button"
          >
            +
          </button>
          <button
            title="Add separator"
            onClick={() => {
              insertItem(createTemplateSeparator());
            }}
            type="button"
          >
            ─
          </button>
          <button
            title="Add group"
            onClick={() => {
              insertItem(createTemplateGroup());
            }}
            type="button"
          >
            ▣
          </button>
          <button
            title="Add row layout"
            onClick={() => {
              insertItem(createTemplateLayout());
            }}
            type="button"
          >
            ▦
          </button>
        </aside>
      </div>
    </div>
  );
}

export function CharacterSheetTemplatePanel() {
  const {
    activeTemplate,
    characterSheetTemplates,
    isLoadingTemplates,
    isSavingTemplate,
    pluginStatuses,
  } = useAppStore();
  const [view, setView] = useState<TemplateView>("list");
  const installedPluginIds = useMemo(
    () => new Set(pluginStatuses.map((status) => status.pluginId)),
    [pluginStatuses],
  );

  useEffect(() => {
    void appStore.loadTemplates();
  }, []);

  async function exportTemplate(template: CharacterSheetTemplate) {
    try {
      console.info("[template-export] Export clicked", {
        templateId: template.id,
        templateName: template.name,
      });
      const manifest = createCharacterSheetTemplatePluginManifest(template);
      const contents = `${JSON.stringify(manifest, null, 2)}\n`;
      const fileName = createPluginManifestFileName(template.name);

      console.info("[template-export] Manifest generated", {
        fileName,
        pluginId: manifest.id,
        contributionId:
          manifest.contributes?.characterSheetTemplates?.[0]?.id,
      });

      const filePath = await save({
        title: "Export character sheet template plugin",
        defaultPath: fileName,
        filters: [
          {
            name: "Soloist Plugin Manifest",
            extensions: ["json"],
          },
        ],
      });

      if (!filePath) {
        console.info("[template-export] Export canceled");
        return;
      }

      console.info("[template-export] Save path chosen", {
        filePath,
      });

      const savedPath = await invoke<string>("export_plugin_manifest", {
        filePath,
        contents,
      });

      console.info("[template-export] Native export complete", {
        savedPath,
      });
      window.alert(`Exported plugin manifest to:\n${savedPath}`);
    } catch (error) {
      console.error("[template-export] Export failed", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Template export failed.",
      );
    }
  }

  if (isLoadingTemplates) {
    return (
      <div className="template-screen">
        <p className="empty-state">Loading templates from SQLite...</p>
      </div>
    );
  }

  if (view === "edit" && activeTemplate) {
    return (
      <TemplateEditor
        onBack={() => {
          setView("list");
          void appStore.loadTemplates();
        }}
        template={activeTemplate}
      />
    );
  }

  return (
    <TemplateList
      installedPluginIds={installedPluginIds}
      onCreate={() => {
        void appStore
          .createTemplate({ name: "New Template" })
          .then((createdTemplate) => {
            if (createdTemplate) {
              setView("edit");
            }
          });
      }}
      onEdit={(template) => {
        appStore.selectTemplate(template.id);
        setView("edit");
      }}
      onExport={exportTemplate}
      onReinstall={(template) => {
        if (!template.sourcePluginId || !template.sourceContributionId) {
          return;
        }

        void appStore
          .reinstallPluginTemplate({
            pluginId: template.sourcePluginId,
            contributionId: template.sourceContributionId,
          })
          .then((createdTemplate) => {
            if (createdTemplate) {
              setView("edit");
            }
          });
      }}
      templates={characterSheetTemplates}
    />
  );
}
