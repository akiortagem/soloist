// Compatibility facade while callers migrate to the feature-owned domain API.
export {
  CURRENT_SOLOIST_API_VERSION,
  SCRIPT_PLUGIN_PERMISSIONS,
  SUPPORTED_SOLOIST_API_VERSIONS,
  type ScriptPluginPermission,
} from "./pluginContract";
export type {
  CharacterSheetTemplateContribution,
  DataSlashCommandContribution,
  OracleTableContribution,
  OracleTableEntry,
  PluginContributions,
  PluginManifest,
  PluginManifestValidationError,
  PluginManifestValidationErrorCode,
  PluginManifestValidationResult,
  PluginType,
} from "../features/plugins/domain/PluginManifest";
export { validatePluginManifest } from "../features/plugins/domain/PluginManifestValidation";
