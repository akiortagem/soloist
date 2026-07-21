export type PluginStatusKind = "loaded" | "disabled" | "invalid" | "error";

export type PluginContributionCounts = {
  slashCommands: number;
  oracleTables: number;
  characterSheetTemplates: number;
};

export type PluginStatusError = {
  path: string;
  code: string;
  message: string;
};

export type PluginStatus = {
  pluginId: string;
  name: string;
  version: string;
  enabled: boolean;
  pluginType: "data" | "script";
  typeLabel: string;
  contributionLabels: string[];
  isCharacterSheetTemplatePlugin: boolean;
  status: PluginStatusKind;
  contributions: PluginContributionCounts;
  errors: PluginStatusError[];
  permissions: string[];
};
