import type { ValidationContext } from "./PluginManifest";
import {
  error,
  optionalLiteral,
  optionalNumber,
  optionalString,
  record,
  rejectKeys,
  requiredArray,
  requiredCharacterValue,
  requiredLiteral,
  requiredString,
} from "./ManifestValidationSupport";

const TEMPLATE_KEYS = ["id", "name", "fields"] as const;
const FIELD_KEYS = [
  "id",
  "kind",
  "name",
  "type",
  "defaultValue",
  "maxValue",
  "minValue",
  "group",
] as const;
const SEPARATOR_KEYS = ["id", "kind", "label"] as const;
const GROUP_KEYS = ["id", "kind", "name", "fields"] as const;
const LAYOUT_KEYS = ["id", "kind", "columns"] as const;
const COLUMN_KEYS = ["id", "fields"] as const;
const FIELD_TYPES = [
  "number",
  "current_max_number",
  "text",
  "boolean",
  "longText",
] as const;

export function validateCharacterSheetTemplateContribution(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(
      context,
      path,
      "INVALID_TYPE",
      "Character sheet template must be an object",
    );
    return;
  }
  rejectKeys(value, TEMPLATE_KEYS, path, context, "UNKNOWN_FIELD");
  requiredString(value, "id", path, context);
  requiredString(value, "name", path, context);
  requiredArray(value, "fields", path, context, validateTemplateItem);
}

function validateTemplateItem(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(
      context,
      path,
      "INVALID_TYPE",
      "Character template item must be an object",
    );
    return;
  }
  const kind = value.kind ?? "field";
  if (kind === "field") validateField(value, path, context);
  else if (kind === "separator") validateSeparator(value, path, context);
  else if (kind === "group") validateGroup(value, path, context);
  else if (kind === "layout") validateLayout(value, path, context);
  else
    error(
      context,
      `${path}.kind`,
      "INVALID_TYPE",
      'Character template item kind must be "field", "separator", "group", or "layout"',
    );
}

function validateField(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  rejectKeys(value, FIELD_KEYS, path, context, "UNKNOWN_FIELD");
  requiredString(value, "id", path, context);
  optionalLiteral(value, "kind", ["field"], path, context);
  requiredString(value, "name", path, context);
  requiredLiteral(value, "type", FIELD_TYPES, path, context);
  requiredCharacterValue(value, "defaultValue", path, context);
  optionalNumber(value, "maxValue", path, context);
  optionalNumber(value, "minValue", path, context);
  optionalString(value, "group", path, context);
}

function validateSeparator(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  rejectKeys(value, SEPARATOR_KEYS, path, context, "UNKNOWN_FIELD");
  requiredString(value, "id", path, context);
  requiredLiteral(value, "kind", ["separator"], path, context);
  optionalString(value, "label", path, context);
}

function validateGroup(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  rejectKeys(value, GROUP_KEYS, path, context, "UNKNOWN_FIELD");
  requiredString(value, "id", path, context);
  requiredLiteral(value, "kind", ["group"], path, context);
  requiredString(value, "name", path, context);
  requiredArray(value, "fields", path, context, validateGroupField);
}

function validateGroupField(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(
      context,
      path,
      "INVALID_TYPE",
      "Character template group field must be an object",
    );
    return;
  }
  validateField(value, path, context);
}

function validateLayout(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  rejectKeys(value, LAYOUT_KEYS, path, context, "UNKNOWN_FIELD");
  requiredString(value, "id", path, context);
  requiredLiteral(value, "kind", ["layout"], path, context);
  requiredArray(value, "columns", path, context, validateColumn);
}

function validateColumn(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(
      context,
      path,
      "INVALID_TYPE",
      "Character template layout column must be an object",
    );
    return;
  }
  rejectKeys(value, COLUMN_KEYS, path, context, "UNKNOWN_FIELD");
  requiredString(value, "id", path, context);
  requiredArray(value, "fields", path, context, validateTemplateItem);
}
