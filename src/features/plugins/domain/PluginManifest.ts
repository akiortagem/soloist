import type { CharacterTemplateItem } from "../../../domain/domainTypes";
import type { ScriptPluginPermission } from "../../../plugins/pluginContract";

export type PluginType = "data" | "script";
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
  | "INVALID_FIELD_VALUE"
  | "UNSUPPORTED_API_VERSION";
export type PluginManifestValidationError = {
  path: string;
  code: PluginManifestValidationErrorCode;
  message: string;
};
export type PluginManifestValidationResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: PluginManifestValidationError[] };
export type ValidationContext = { errors: PluginManifestValidationError[] };
