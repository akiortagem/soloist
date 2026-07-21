import { validateSlashCommandRegistration } from "../../../plugins/pluginValidation";
import {
  CURRENT_SOLOIST_API_VERSION,
  SCRIPT_PLUGIN_PERMISSIONS,
  SUPPORTED_SOLOIST_API_VERSIONS,
} from "../../../plugins/pluginContract";
import { validateCharacterSheetTemplateContribution } from "./CharacterTemplateManifestValidation";
import type {
  PluginManifest,
  PluginManifestValidationResult,
  ValidationContext,
} from "./PluginManifest";
import {
  error,
  hasOwn,
  missing,
  optionalArray,
  optionalString,
  record,
  rejectKeys,
  requiredArray,
  requiredNumber,
  requiredString,
} from "./ManifestValidationSupport";

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
const COMMAND_KEYS = [
  "id",
  "name",
  "label",
  "prefix",
  "description",
  "commandText",
  "tableId",
] as const;
const TABLE_KEYS = ["id", "name", "description", "dice", "entries"] as const;
const ENTRY_KEYS = ["id", "min", "max", "text"] as const;

export function validatePluginManifest(
  value: unknown,
): PluginManifestValidationResult {
  const context: ValidationContext = { errors: [] };
  validateManifest(value, "$", context);
  return context.errors.length > 0
    ? { ok: false, errors: context.errors }
    : { ok: true, manifest: value as PluginManifest };
}

function validateManifest(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(context, path, "INVALID_TYPE", "Plugin manifest must be an object");
    return;
  }
  rejectKeys(value, MANIFEST_KEYS, path, context, "UNKNOWN_FIELD");
  for (const key of ["id", "name", "version", "soloistApiVersion"])
    requiredString(value, key, path, context);
  if (
    typeof value.soloistApiVersion === "string" &&
    value.soloistApiVersion.trim().length > 0 &&
    !(SUPPORTED_SOLOIST_API_VERSIONS as readonly string[]).includes(
      value.soloistApiVersion,
    )
  )
    error(
      context,
      `${path}.soloistApiVersion`,
      "UNSUPPORTED_API_VERSION",
      `Unsupported Soloist API version "${value.soloistApiVersion}"; supported version: ${CURRENT_SOLOIST_API_VERSION}`,
    );
  if (!hasOwn(value, "type")) missing(context, path, "type");
  else if (value.type !== "data" && value.type !== "script")
    error(
      context,
      `${path}.type`,
      "UNKNOWN_PLUGIN_TYPE",
      'Plugin type must be "data" or "script"',
    );
  else if (value.type === "script") {
    requiredString(value, "entry", path, context);
    validatePermissions(value, path, context);
  } else optionalString(value, "entry", path, context);
  if (hasOwn(value, "contributes"))
    validateContributions(value.contributes, `${path}.contributes`, context);
}

function validatePermissions(
  value: Record<string, unknown>,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, "permissions")) {
    missing(context, path, "permissions");
    return;
  }
  if (!Array.isArray(value.permissions)) {
    error(
      context,
      `${path}.permissions`,
      "INVALID_ARRAY",
      "permissions must be an array",
    );
    return;
  }
  value.permissions.forEach((permission, index) => {
    const itemPath = `${path}.permissions[${index}]`;
    if (typeof permission !== "string")
      error(context, itemPath, "INVALID_TYPE", "Permission must be a string");
    else if (
      !(SCRIPT_PLUGIN_PERMISSIONS as readonly string[]).includes(permission)
    )
      error(
        context,
        itemPath,
        "INVALID_FIELD_VALUE",
        `Unknown script plugin permission: ${permission}`,
      );
  });
}

function validateContributions(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(context, path, "INVALID_TYPE", "contributes must be an object");
    return;
  }
  rejectKeys(
    value,
    CONTRIBUTION_KEYS,
    path,
    context,
    "UNKNOWN_CONTRIBUTION_TYPE",
  );
  optionalArray(value, "slashCommands", path, context, validateCommand);
  validateCommandUniqueness(value.slashCommands, path, context);
  optionalArray(value, "randomTables", path, context, validateTable);
  optionalArray(value, "oracleTables", path, context, validateTable);
  optionalArray(
    value,
    "characterSheetTemplates",
    path,
    context,
    validateCharacterSheetTemplateContribution,
  );
}

function validateCommandUniqueness(
  commands: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!Array.isArray(commands)) return;
  const ids = new Set<string>();
  const names = new Set<string>();
  commands.forEach((item, index) => {
    if (!record(item)) return;
    if (typeof item.id === "string") {
      if (ids.has(item.id))
        error(
          context,
          `${path}.slashCommands[${index}].id`,
          "INVALID_FIELD_VALUE",
          `Duplicate slash command id: ${item.id}`,
        );
      ids.add(item.id);
    }
    if (typeof item.name === "string") {
      const name = item.name.toLowerCase();
      if (names.has(name))
        error(
          context,
          `${path}.slashCommands[${index}].name`,
          "INVALID_FIELD_VALUE",
          `Duplicate slash command name: ${item.name}`,
        );
      names.add(name);
    }
  });
}

function validateCommand(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(context, path, "INVALID_TYPE", "Slash command must be an object");
    return;
  }
  rejectKeys(value, COMMAND_KEYS, path, context, "UNKNOWN_FIELD");
  for (const key of ["id", "name", "label", "prefix"])
    requiredString(value, key, path, context);
  for (const key of ["description", "commandText", "tableId"])
    optionalString(value, key, path, context);
  try {
    validateSlashCommandRegistration({
      id: value.id,
      name: value.name,
      label: value.label,
      prefix: value.prefix,
      ...(value.description === undefined
        ? {}
        : { description: value.description }),
    });
  } catch (validationError) {
    error(
      context,
      path,
      "INVALID_FIELD_VALUE",
      validationError instanceof Error
        ? validationError.message
        : String(validationError),
    );
  }
  if (!hasOwn(value, "commandText") && !hasOwn(value, "tableId"))
    error(
      context,
      `${path}.commandText`,
      "MISSING_FIELD",
      "Slash command requires commandText or tableId",
    );
}

function validateTable(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(context, path, "INVALID_TYPE", "Oracle table must be an object");
    return;
  }
  rejectKeys(value, TABLE_KEYS, path, context, "UNKNOWN_FIELD");
  requiredString(value, "id", path, context);
  requiredString(value, "name", path, context);
  optionalString(value, "description", path, context);
  requiredString(value, "dice", path, context);
  requiredArray(value, "entries", path, context, validateEntry);
}

function validateEntry(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!record(value)) {
    error(
      context,
      path,
      "INVALID_TYPE",
      "Oracle table entry must be an object",
    );
    return;
  }
  rejectKeys(value, ENTRY_KEYS, path, context, "UNKNOWN_FIELD");
  requiredString(value, "id", path, context);
  requiredNumber(value, "min", path, context);
  requiredNumber(value, "max", path, context);
  requiredString(value, "text", path, context);
  if (
    typeof value.min === "number" &&
    Number.isFinite(value.min) &&
    typeof value.max === "number" &&
    Number.isFinite(value.max) &&
    value.min > value.max
  )
    error(
      context,
      `${path}.min`,
      "INVALID_NUMBER",
      "Oracle table entry min cannot be greater than max",
    );
}
