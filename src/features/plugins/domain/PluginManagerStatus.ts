import type { InstalledPluginRecord } from "../../../persistence/pluginRepository";
import type { PluginManifestValidationError } from "../../../plugins/pluginTypes";

export type PluginManagerStatusKind =
  "loaded" | "disabled" | "invalid" | "error";

export type PluginContributionCounts = {
  slashCommands: number;
  oracleTables: number;
  characterSheetTemplates: number;
};

export type PluginManagerStatus = {
  pluginId: string;
  name: string;
  version: string;
  enabled: boolean;
  pluginType: InstalledPluginRecord["type"];
  typeLabel: string;
  contributionLabels: string[];
  isCharacterSheetTemplatePlugin: boolean;
  status: PluginManagerStatusKind;
  contributions: PluginContributionCounts;
  errors: PluginManifestValidationError[];
  permissions: string[];
};

export const EMPTY_CONTRIBUTION_COUNTS: PluginContributionCounts = {
  slashCommands: 0,
  oracleTables: 0,
  characterSheetTemplates: 0,
};

export function createPluginManagerStatus(
  plugin: InstalledPluginRecord,
  status: PluginManagerStatusKind,
  errors: PluginManifestValidationError[] = [],
  contributions: PluginContributionCounts = EMPTY_CONTRIBUTION_COUNTS,
): PluginManagerStatus {
  return {
    pluginId: plugin.id,
    name: plugin.name,
    version: plugin.version,
    enabled: plugin.enabled,
    pluginType: plugin.type,
    typeLabel: plugin.type === "data" ? "Data" : "Script",
    contributionLabels: contributionLabels(plugin),
    isCharacterSheetTemplatePlugin:
      (plugin.manifest.contributes?.characterSheetTemplates?.length ?? 0) > 0,
    status,
    contributions: { ...contributions },
    errors: errors.map((error) => ({ ...error })),
    permissions: [...(plugin.manifest.permissions ?? [])],
  };
}

export function clonePluginManagerStatus(
  status: PluginManagerStatus,
): PluginManagerStatus {
  return {
    ...status,
    contributionLabels: [...status.contributionLabels],
    contributions: { ...status.contributions },
    errors: status.errors.map((error) => ({ ...error })),
    permissions: [...status.permissions],
  };
}

function contributionLabels(plugin: InstalledPluginRecord): string[] {
  const contributions = plugin.manifest.contributes;
  const labels: string[] = [];
  if ((contributions?.characterSheetTemplates?.length ?? 0) > 0)
    labels.push("Character sheet template");
  if ((contributions?.slashCommands?.length ?? 0) > 0)
    labels.push("Slash command");
  if (
    (contributions?.randomTables?.length ?? 0) > 0 ||
    (contributions?.oracleTables?.length ?? 0) > 0
  )
    labels.push("Oracle table");
  return labels;
}
