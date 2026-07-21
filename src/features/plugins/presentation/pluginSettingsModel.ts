import type { PluginManifest } from "../../../plugins/pluginTypes";

export type PluginPackageInstallResult = {
  folderName: string;
  installedPath: string;
  manifestText: string;
};

export function isCharacterSheetTemplateManifest(manifest: PluginManifest) {
  return (
    manifest.type === "data" &&
    (manifest.contributes?.characterSheetTemplates?.length ?? 0) > 0
  );
}

export function createPluginTypeText(plugin: {
  typeLabel: string;
  contributionLabels: string[];
}) {
  return [plugin.typeLabel, ...plugin.contributionLabels].join(" · ");
}
