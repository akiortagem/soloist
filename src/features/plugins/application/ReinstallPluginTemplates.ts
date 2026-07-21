import {
  PluginApplicationError,
  pluginNotFound,
} from "./PluginApplicationError";
import type {
  InstalledPlugin,
  PluginRepository,
  PluginTemplates,
} from "./ports/PluginPorts";

export function createReinstallPluginTemplates(dependencies: {
  plugins: PluginRepository;
  templates: PluginTemplates;
}) {
  return async function reinstallPluginTemplates(pluginId: string) {
    let createdCount = 0;
    try {
      const plugin = await dependencies.plugins.get(pluginId);
      if (!plugin) throw pluginNotFound(pluginId);
      const createdTemplates = [];
      for (const contribution of templateContributions(plugin)) {
        createdTemplates.push(
          await dependencies.templates.reinstall({
            pluginId,
            contributionId: contribution.id,
          }),
        );
        createdCount += 1;
      }
      return {
        plugin,
        createdTemplates,
        templates: await dependencies.templates.list(),
      };
    } catch (error) {
      if (error instanceof PluginApplicationError) throw error;
      throw new PluginApplicationError(
        "template_reinstall_failed",
        error,
        [pluginId, String(createdCount)],
        createdCount > 0 ? "refresh" : "persist",
        createdCount > 0,
      );
    }
  };
}

function templateContributions(plugin: InstalledPlugin) {
  return plugin.manifest.contributes?.characterSheetTemplates ?? [];
}
