import type {
  CharacterField,
  CharacterTemplateField,
  CharacterTemplateGroup,
  CharacterTemplateItem,
  CharacterTemplateLayout,
  CharacterTemplateLayoutColumn,
  CharacterTemplateSeparator,
} from "./characterSheetTypes";
import { createId } from "../shared/infrastructure/systemValues";

export const CHARACTER_TEMPLATE_FIELD_TYPES = [
  "number",
  "current_max_number",
  "text",
  "boolean",
  "longText",
] as const satisfies readonly CharacterTemplateField["type"][];

function coerceNumberValue(value: unknown) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function coerceNonNegativeNumberValue(value: unknown) {
  return Math.max(0, coerceNumberValue(value));
}

function coerceCurrentMaxNumberValue(value: unknown) {
  if (value && typeof value === "object") {
    const candidate = value as { current?: unknown; max?: unknown };

    return {
      current: coerceNonNegativeNumberValue(candidate.current),
      max: coerceNonNegativeNumberValue(candidate.max),
    };
  }

  const numericValue = coerceNonNegativeNumberValue(value);

  return {
    current: numericValue,
    max: numericValue,
  };
}

export function getDefaultValueForTemplateField(
  type: CharacterTemplateField["type"],
) {
  if (type === "number") {
    return 0;
  }

  if (type === "current_max_number") {
    return {
      current: 0,
      max: 0,
    };
  }

  if (type === "boolean") {
    return false;
  }

  return "";
}

export function coerceTemplateFieldDefaultValue(
  type: CharacterTemplateField["type"],
  value: unknown,
) {
  if (type === "number") {
    return coerceNumberValue(value);
  }

  if (type === "current_max_number") {
    return coerceCurrentMaxNumberValue(value);
  }

  if (type === "boolean") {
    return value === true || value === "true";
  }

  return String(value);
}

export function createTemplateField(
  input?: Partial<Omit<CharacterTemplateField, "id" | "kind">>,
): CharacterTemplateField {
  const type = input?.type ?? "text";

  return {
    id: createId("template_field"),
    kind: "field",
    name: input?.name ?? "New field",
    type,
    defaultValue: coerceTemplateFieldDefaultValue(
      type,
      input?.defaultValue ?? getDefaultValueForTemplateField(type),
    ),
    minValue: input?.minValue,
    maxValue: input?.maxValue,
    group: input?.group,
  };
}

function createCharacterFieldFromTemplateField(
  field: CharacterTemplateField,
  group?: string,
): CharacterField {
  return {
    id: createId("field"),
    templateFieldId: field.id,
    name: field.name,
    type: field.type,
    value: field.defaultValue,
    maxValue: field.maxValue,
    minValue: field.minValue,
    group: field.group ?? group,
  };
}

export function normalizeCharacterField(field: CharacterField): CharacterField {
  const minValue =
    field.type === "number" && typeof field.minValue === "number"
      ? field.minValue
      : undefined;
  const maxValue =
    field.type === "number" && typeof field.maxValue === "number"
      ? field.maxValue
      : undefined;

  return {
    id: field.id,
    templateFieldId: field.templateFieldId,
    name: field.name.trim() || "Untitled field",
    type: field.type,
    value: coerceTemplateFieldDefaultValue(field.type, field.value),
    minValue,
    maxValue,
    group: field.group?.trim() || undefined,
  };
}

export function normalizeCharacterFields(fields: CharacterField[]) {
  return fields.map(normalizeCharacterField);
}

export function createTemplateSeparator(
  input?: Partial<Omit<CharacterTemplateSeparator, "id" | "kind">>,
): CharacterTemplateSeparator {
  return {
    id: createId("template_separator"),
    kind: "separator",
    label: input?.label ?? "Separator",
  };
}

export function createTemplateGroup(
  input?: Partial<Omit<CharacterTemplateGroup, "id" | "kind">>,
): CharacterTemplateGroup {
  return {
    id: createId("template_group"),
    kind: "group",
    name: input?.name ?? "New group",
    fields: input?.fields ?? [],
  };
}

export function createTemplateLayoutColumn(
  input?: Partial<Omit<CharacterTemplateLayoutColumn, "id">>,
): CharacterTemplateLayoutColumn {
  return {
    id: createId("template_column"),
    fields: input?.fields ?? [],
  };
}

export function createTemplateLayout(
  input?: Partial<Omit<CharacterTemplateLayout, "id" | "kind">>,
): CharacterTemplateLayout {
  return {
    id: createId("template_layout"),
    kind: "layout",
    columns:
      input?.columns ??
      [createTemplateLayoutColumn(), createTemplateLayoutColumn()],
  };
}

export function isTemplateSeparator(
  item: CharacterTemplateItem,
): item is CharacterTemplateSeparator {
  return item.kind === "separator";
}

export function isTemplateGroup(
  item: CharacterTemplateItem,
): item is CharacterTemplateGroup {
  return item.kind === "group";
}

export function isTemplateLayout(
  item: CharacterTemplateItem,
): item is CharacterTemplateLayout {
  return item.kind === "layout";
}

export function isTemplateField(
  item: CharacterTemplateItem,
): item is CharacterTemplateField {
  return (
    !isTemplateSeparator(item) &&
    !isTemplateGroup(item) &&
    !isTemplateLayout(item)
  );
}

export function normalizeTemplateItem(
  item: CharacterTemplateItem,
): CharacterTemplateItem {
  if (isTemplateSeparator(item)) {
    return {
      id: item.id,
      kind: "separator",
      label: item.label?.trim() || undefined,
    };
  }

  if (isTemplateGroup(item)) {
    return {
      id: item.id,
      kind: "group",
      name: item.name.trim() || "Untitled group",
      fields: item.fields.map((field) => normalizeTemplateField(field)),
    };
  }

  if (isTemplateLayout(item)) {
    const columns = item.columns.length > 0 ? item.columns : [];

    return {
      id: item.id,
      kind: "layout",
      columns: columns.map((column) => ({
        id: column.id,
        fields: normalizeTemplateItems(column.fields),
      })),
    };
  }

  return normalizeTemplateField(item);
}

function normalizeTemplateField(
  item: CharacterTemplateField,
): CharacterTemplateField {
  const minValue =
    item.type === "number" && typeof item.minValue === "number"
      ? item.minValue
      : undefined;
  const maxValue =
    item.type === "number" && typeof item.maxValue === "number"
      ? item.maxValue
      : undefined;

  return {
    id: item.id,
    kind: "field",
    name: item.name.trim() || "Untitled field",
    type: item.type,
    defaultValue: coerceTemplateFieldDefaultValue(
      item.type,
      item.defaultValue,
    ),
    minValue,
    maxValue,
    group: item.group?.trim() || undefined,
  };
}

export function normalizeTemplateItems(items: CharacterTemplateItem[]) {
  const normalizedItems: CharacterTemplateItem[] = [];
  const groupIndexes = new Map<string, number>();

  for (const item of items.map(normalizeTemplateItem)) {
    if (isTemplateField(item) && item.group) {
      const groupName = item.group;
      const field = { ...item, group: undefined };
      const existingGroupIndex = groupIndexes.get(groupName);

      if (existingGroupIndex === undefined) {
        groupIndexes.set(groupName, normalizedItems.length);
        normalizedItems.push(
          createTemplateGroup({
            name: groupName,
            fields: [field],
          }),
        );
      } else {
        const existingGroup = normalizedItems[existingGroupIndex];

        if (isTemplateGroup(existingGroup)) {
          normalizedItems[existingGroupIndex] = {
            ...existingGroup,
            fields: [...existingGroup.fields, field],
          };
        }
      }
      continue;
    }

    normalizedItems.push(item);
  }

  return normalizedItems;
}

export function createFieldsFromTemplate(
  items: CharacterTemplateItem[],
): CharacterField[] {
  const fields: CharacterField[] = [];

  function appendItems(nextItems: CharacterTemplateItem[], group?: string) {
    for (const item of nextItems) {
      if (isTemplateGroup(item)) {
        appendItems(item.fields, item.name);
        continue;
      }

      if (isTemplateLayout(item)) {
        for (const column of item.columns) {
          appendItems(column.fields, group);
        }
        continue;
      }

      if (!isTemplateField(item)) {
        continue;
      }

      fields.push(createCharacterFieldFromTemplateField(item, group));
    }
  }

  appendItems(normalizeTemplateItems(items));
  return normalizeCharacterFields(fields);
}

export function syncFieldsWithTemplate(
  sheetFields: CharacterField[],
  templateItems: CharacterTemplateItem[],
): CharacterField[] {
  const templateFields = createFieldsFromTemplate(templateItems);
  const normalizedSheetFields = normalizeCharacterFields(sheetFields);
  const existingByTemplateId = new Map<string, CharacterField>();
  const existingByName = new Map<string, CharacterField>();

  for (const field of normalizedSheetFields) {
    if (field.templateFieldId) {
      existingByTemplateId.set(field.templateFieldId, field);
    }

    existingByName.set(field.name.trim().toLocaleLowerCase(), field);
  }

  const syncedFields = normalizedSheetFields.map((field) => {
    if (field.templateFieldId) {
      return field;
    }

    const matchingTemplateField = templateFields.find(
      (templateField) =>
        templateField.name.trim().toLocaleLowerCase() ===
        field.name.trim().toLocaleLowerCase(),
    );

    return matchingTemplateField
      ? {
          ...field,
          templateFieldId: matchingTemplateField.templateFieldId,
          group: field.group ?? matchingTemplateField.group,
        }
      : field;
  });

  for (const templateField of templateFields) {
    if (
      templateField.templateFieldId &&
      existingByTemplateId.has(templateField.templateFieldId)
    ) {
      continue;
    }

    if (existingByName.has(templateField.name.trim().toLocaleLowerCase())) {
      continue;
    }

    syncedFields.push(templateField);
  }

  return syncedFields;
}
