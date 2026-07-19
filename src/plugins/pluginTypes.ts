import type {
  CharacterFieldValue,
  CharacterTemplateItem,
} from "../domain/domainTypes";

export type PluginType = "data" | "script";

export const SCRIPT_PLUGIN_PERMISSIONS = [
  "storage",
  "slashCommands:register",
  "oracleProviders:register",
  "document:readSelection",
  "document:insertBlock",
] as const;

export type ScriptPluginPermission = (typeof SCRIPT_PLUGIN_PERMISSIONS)[number];

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  soloistApiVersion: string;
  type: PluginType;
  entry?: string;
  permissions?: ScriptPluginPermission[];
  contributes?: PluginContributions;
};

export type PluginContributions = {
  slashCommands?: DataSlashCommandContribution[];
  randomTables?: OracleTableContribution[];
  oracleTables?: OracleTableContribution[];
  characterSheetTemplates?: CharacterSheetTemplateContribution[];
};

export type DataSlashCommandContribution = {
  id: string;
  name: string;
  label: string;
  prefix: string;
  description?: string;
  commandText?: string;
  tableId?: string;
};

export type OracleTableContribution = {
  id: string;
  name: string;
  description?: string;
  dice: string;
  entries: OracleTableEntry[];
};

export type OracleTableEntry = {
  id: string;
  min: number;
  max: number;
  text: string;
};

export type CharacterSheetTemplateContribution = {
  id: string;
  name: string;
  fields: CharacterTemplateItem[];
};

export type PluginManifestValidationErrorCode =
  | "INVALID_TYPE"
  | "MISSING_FIELD"
  | "UNKNOWN_FIELD"
  | "UNKNOWN_PLUGIN_TYPE"
  | "UNKNOWN_CONTRIBUTION_TYPE"
  | "EMPTY_STRING"
  | "INVALID_ARRAY"
  | "INVALID_NUMBER"
  | "INVALID_FIELD_VALUE";

export type PluginManifestValidationError = {
  path: string;
  code: PluginManifestValidationErrorCode;
  message: string;
};

export type PluginManifestValidationResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: PluginManifestValidationError[] };

type ValidationContext = {
  errors: PluginManifestValidationError[];
};

const MANIFEST_KEYS = [
  "id",
  "name",
  "version",
  "soloistApiVersion",
  "type",
  "entry",
  "permissions",
  "contributes",
] as const;

const CONTRIBUTION_KEYS = [
  "slashCommands",
  "randomTables",
  "oracleTables",
  "characterSheetTemplates",
] as const;

const SLASH_COMMAND_KEYS = [
  "id",
  "name",
  "label",
  "prefix",
  "description",
  "commandText",
  "tableId",
] as const;

const ORACLE_TABLE_KEYS = [
  "id",
  "name",
  "description",
  "dice",
  "entries",
] as const;

const ORACLE_TABLE_ENTRY_KEYS = ["id", "min", "max", "text"] as const;

const CHARACTER_SHEET_TEMPLATE_KEYS = ["id", "name", "fields"] as const;

const CHARACTER_TEMPLATE_FIELD_KEYS = [
  "id",
  "kind",
  "name",
  "type",
  "defaultValue",
  "maxValue",
  "minValue",
  "group",
] as const;

const CHARACTER_TEMPLATE_SEPARATOR_KEYS = ["id", "kind", "label"] as const;

const CHARACTER_TEMPLATE_GROUP_KEYS = ["id", "kind", "name", "fields"] as const;

const CHARACTER_TEMPLATE_LAYOUT_KEYS = ["id", "kind", "columns"] as const;

const CHARACTER_TEMPLATE_LAYOUT_COLUMN_KEYS = ["id", "fields"] as const;

const CHARACTER_FIELD_TYPES = [
  "number",
  "current_max_number",
  "text",
  "boolean",
  "longText",
] as const;

export function validatePluginManifest(
  value: unknown,
): PluginManifestValidationResult {
  const context: ValidationContext = { errors: [] };

  validateManifest(value, "$", context);

  if (context.errors.length > 0) {
    return { ok: false, errors: context.errors };
  }

  return { ok: true, manifest: value as PluginManifest };
}

function validateManifest(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(context, path, "INVALID_TYPE", "Plugin manifest must be an object");
    return;
  }

  rejectUnknownKeys(value, MANIFEST_KEYS, path, context, "UNKNOWN_FIELD");
  requireString(value, "id", path, context);
  requireString(value, "name", path, context);
  requireString(value, "version", path, context);
  requireString(value, "soloistApiVersion", path, context);

  if (!hasOwn(value, "type")) {
    addMissingField(context, path, "type");
  } else if (value.type !== "data" && value.type !== "script") {
    addError(
      context,
      `${path}.type`,
      "UNKNOWN_PLUGIN_TYPE",
      'Plugin type must be "data" or "script"',
    );
  } else if (value.type === "script") {
    requireString(value, "entry", path, context);
    validateScriptPermissions(value, path, context);
  } else {
    optionalString(value, "entry", path, context);
  }

  if (hasOwn(value, "contributes")) {
    validateContributions(value.contributes, `${path}.contributes`, context);
  }
}

function validateScriptPermissions(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, "permissions")) {
    addMissingField(context, path, "permissions");
    return;
  }
  if (!Array.isArray(value.permissions)) {
    addError(context, `${path}.permissions`, "INVALID_ARRAY", "permissions must be an array");
    return;
  }
  value.permissions.forEach((permission, index) => {
    const permissionPath = `${path}.permissions[${index}]`;
    if (typeof permission !== "string") {
      addError(context, permissionPath, "INVALID_TYPE", "Permission must be a string");
    } else if (!(SCRIPT_PLUGIN_PERMISSIONS as readonly string[]).includes(permission)) {
      addError(context, permissionPath, "INVALID_FIELD_VALUE", `Unknown script plugin permission: ${permission}`);
    }
  });
}

function validateContributions(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(context, path, "INVALID_TYPE", "contributes must be an object");
    return;
  }

  rejectUnknownKeys(
    value,
    CONTRIBUTION_KEYS,
    path,
    context,
    "UNKNOWN_CONTRIBUTION_TYPE",
  );

  validateOptionalArray(
    value,
    "slashCommands",
    path,
    context,
    validateSlashCommandContribution,
  );
  validateOptionalArray(
    value,
    "randomTables",
    path,
    context,
    validateOracleTableContribution,
  );
  validateOptionalArray(
    value,
    "oracleTables",
    path,
    context,
    validateOracleTableContribution,
  );
  validateOptionalArray(
    value,
    "characterSheetTemplates",
    path,
    context,
    validateCharacterSheetTemplateContribution,
  );
}

function validateSlashCommandContribution(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(context, path, "INVALID_TYPE", "Slash command must be an object");
    return;
  }

  rejectUnknownKeys(value, SLASH_COMMAND_KEYS, path, context, "UNKNOWN_FIELD");
  requireString(value, "id", path, context);
  requireString(value, "name", path, context);
  requireString(value, "label", path, context);
  requireString(value, "prefix", path, context);
  optionalString(value, "description", path, context);
  optionalString(value, "commandText", path, context);
  optionalString(value, "tableId", path, context);

  if (!hasOwn(value, "commandText") && !hasOwn(value, "tableId")) {
    addError(
      context,
      `${path}.commandText`,
      "MISSING_FIELD",
      "Slash command requires commandText or tableId",
    );
  }
}

function validateOracleTableContribution(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(context, path, "INVALID_TYPE", "Oracle table must be an object");
    return;
  }

  rejectUnknownKeys(value, ORACLE_TABLE_KEYS, path, context, "UNKNOWN_FIELD");
  requireString(value, "id", path, context);
  requireString(value, "name", path, context);
  optionalString(value, "description", path, context);
  requireString(value, "dice", path, context);

  validateRequiredArray(
    value,
    "entries",
    path,
    context,
    validateOracleTableEntry,
  );
}

function validateOracleTableEntry(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(context, path, "INVALID_TYPE", "Oracle table entry must be an object");
    return;
  }

  rejectUnknownKeys(value, ORACLE_TABLE_ENTRY_KEYS, path, context, "UNKNOWN_FIELD");
  requireString(value, "id", path, context);
  requireNumber(value, "min", path, context);
  requireNumber(value, "max", path, context);
  requireString(value, "text", path, context);

  if (
    typeof value.min === "number" &&
    Number.isFinite(value.min) &&
    typeof value.max === "number" &&
    Number.isFinite(value.max) &&
    value.min > value.max
  ) {
    addError(
      context,
      `${path}.min`,
      "INVALID_NUMBER",
      "Oracle table entry min cannot be greater than max",
    );
  }
}

function validateCharacterSheetTemplateContribution(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(
      context,
      path,
      "INVALID_TYPE",
      "Character sheet template must be an object",
    );
    return;
  }

  rejectUnknownKeys(
    value,
    CHARACTER_SHEET_TEMPLATE_KEYS,
    path,
    context,
    "UNKNOWN_FIELD",
  );
  requireString(value, "id", path, context);
  requireString(value, "name", path, context);
  validateRequiredArray(
    value,
    "fields",
    path,
    context,
    validateCharacterTemplateItem,
  );
}

function validateCharacterTemplateItem(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(
      context,
      path,
      "INVALID_TYPE",
      "Character template item must be an object",
    );
    return;
  }

  const kind = value.kind ?? "field";

  if (kind === "field") {
    validateCharacterTemplateField(value, path, context);
    return;
  }

  if (kind === "separator") {
    validateCharacterTemplateSeparator(value, path, context);
    return;
  }

  if (kind === "group") {
    validateCharacterTemplateGroup(value, path, context);
    return;
  }

  if (kind === "layout") {
    validateCharacterTemplateLayout(value, path, context);
    return;
  }

  addError(
    context,
    `${path}.kind`,
    "INVALID_TYPE",
    'Character template item kind must be "field", "separator", "group", or "layout"',
  );
}

function validateCharacterTemplateField(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  rejectUnknownKeys(
    value,
    CHARACTER_TEMPLATE_FIELD_KEYS,
    path,
    context,
    "UNKNOWN_FIELD",
  );
  requireString(value, "id", path, context);
  optionalLiteral(value, "kind", ["field"], path, context);
  requireString(value, "name", path, context);
  requireLiteral(value, "type", CHARACTER_FIELD_TYPES, path, context);
  requireCharacterFieldValue(value, "defaultValue", path, context);
  optionalNumber(value, "maxValue", path, context);
  optionalNumber(value, "minValue", path, context);
  optionalString(value, "group", path, context);
}

function validateCharacterTemplateSeparator(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  rejectUnknownKeys(
    value,
    CHARACTER_TEMPLATE_SEPARATOR_KEYS,
    path,
    context,
    "UNKNOWN_FIELD",
  );
  requireString(value, "id", path, context);
  requireLiteral(value, "kind", ["separator"], path, context);
  optionalString(value, "label", path, context);
}

function validateCharacterTemplateGroup(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  rejectUnknownKeys(
    value,
    CHARACTER_TEMPLATE_GROUP_KEYS,
    path,
    context,
    "UNKNOWN_FIELD",
  );
  requireString(value, "id", path, context);
  requireLiteral(value, "kind", ["group"], path, context);
  requireString(value, "name", path, context);
  validateRequiredArray(
    value,
    "fields",
    path,
    context,
    validateCharacterTemplateGroupField,
  );
}

function validateCharacterTemplateGroupField(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(
      context,
      path,
      "INVALID_TYPE",
      "Character template group field must be an object",
    );
    return;
  }

  validateCharacterTemplateField(value, path, context);
}

function validateCharacterTemplateLayout(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  rejectUnknownKeys(
    value,
    CHARACTER_TEMPLATE_LAYOUT_KEYS,
    path,
    context,
    "UNKNOWN_FIELD",
  );
  requireString(value, "id", path, context);
  requireLiteral(value, "kind", ["layout"], path, context);
  validateRequiredArray(
    value,
    "columns",
    path,
    context,
    validateCharacterTemplateLayoutColumn,
  );
}

function validateCharacterTemplateLayoutColumn(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!isRecord(value)) {
    addError(
      context,
      path,
      "INVALID_TYPE",
      "Character template layout column must be an object",
    );
    return;
  }

  rejectUnknownKeys(
    value,
    CHARACTER_TEMPLATE_LAYOUT_COLUMN_KEYS,
    path,
    context,
    "UNKNOWN_FIELD",
  );
  requireString(value, "id", path, context);
  validateRequiredArray(
    value,
    "fields",
    path,
    context,
    validateCharacterTemplateItem,
  );
}

function validateOptionalArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
  validateItem: (item: unknown, itemPath: string, context: ValidationContext) => void,
): void {
  if (!hasOwn(value, key)) {
    return;
  }

  validateArray(value[key], `${path}.${key}`, context, validateItem);
}

function validateRequiredArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
  validateItem: (item: unknown, itemPath: string, context: ValidationContext) => void,
): void {
  if (!hasOwn(value, key)) {
    addMissingField(context, path, key);
    return;
  }

  validateArray(value[key], `${path}.${key}`, context, validateItem);
}

function validateArray(
  value: unknown,
  path: string,
  context: ValidationContext,
  validateItem: (item: unknown, itemPath: string, context: ValidationContext) => void,
): void {
  if (!Array.isArray(value)) {
    addError(context, path, "INVALID_ARRAY", `${path} must be an array`);
    return;
  }

  value.forEach((item, index) => validateItem(item, `${path}[${index}]`, context));
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    addMissingField(context, path, key);
    return;
  }

  if (typeof value[key] !== "string") {
    addError(context, `${path}.${key}`, "INVALID_TYPE", `${key} must be a string`);
    return;
  }

  if (value[key].trim().length === 0) {
    addError(
      context,
      `${path}.${key}`,
      "EMPTY_STRING",
      `${key} cannot be empty`,
    );
  }
}

function optionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    return;
  }

  if (typeof value[key] !== "string") {
    addError(context, `${path}.${key}`, "INVALID_TYPE", `${key} must be a string`);
  }
}

function requireNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    addMissingField(context, path, key);
    return;
  }

  if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
    addError(
      context,
      `${path}.${key}`,
      "INVALID_NUMBER",
      `${key} must be a finite number`,
    );
  }
}

function optionalNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    return;
  }

  if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
    addError(
      context,
      `${path}.${key}`,
      "INVALID_NUMBER",
      `${key} must be a finite number`,
    );
  }
}

function requireLiteral<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    addMissingField(context, path, key);
    return;
  }

  optionalLiteral(value, key, allowedValues, path, context);
}

function optionalLiteral<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    return;
  }

  if (!allowedValues.includes(value[key] as T)) {
    addError(
      context,
      `${path}.${key}`,
      "INVALID_TYPE",
      `${key} must be one of: ${allowedValues.join(", ")}`,
    );
  }
}

function requireCharacterFieldValue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    addMissingField(context, path, key);
    return;
  }

  if (!isCharacterFieldValue(value[key])) {
    addError(
      context,
      `${path}.${key}`,
      "INVALID_FIELD_VALUE",
      "defaultValue must be a string, number, boolean, or current/max number object",
    );
  }
}

function isCharacterFieldValue(value: unknown): value is CharacterFieldValue {
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  return (
    isRecord(value) &&
    typeof value.current === "number" &&
    Number.isFinite(value.current) &&
    typeof value.max === "number" &&
    Number.isFinite(value.max) &&
    Object.keys(value).every((key) => key === "current" || key === "max")
  );
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  context: ValidationContext,
  code: Extract<
    PluginManifestValidationErrorCode,
    "UNKNOWN_FIELD" | "UNKNOWN_CONTRIBUTION_TYPE"
  >,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      addError(
        context,
        `${path}.${key}`,
        code,
        code === "UNKNOWN_CONTRIBUTION_TYPE"
          ? `Unknown contribution type: ${key}`
          : `Unknown field: ${key}`,
      );
    }
  }
}

function addMissingField(
  context: ValidationContext,
  path: string,
  key: string,
): void {
  addError(
    context,
    `${path}.${key}`,
    "MISSING_FIELD",
    `Missing required field: ${key}`,
  );
}

function addError(
  context: ValidationContext,
  path: string,
  code: PluginManifestValidationErrorCode,
  message: string,
): void {
  context.errors.push({ path, code, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
