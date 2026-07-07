import { normalizeTemplateItems } from "../../characterSheets/characterSheetTemplateLogic";
import { importCharacterSheetTemplatesFromPlugins } from "../../plugins/characterSheetTemplateImporter";
import { PluginManager } from "../../plugins/pluginManager";
import {
  type PluginManifest,
  validatePluginManifest,
} from "../../plugins/pluginTypes";
import { createRepositories } from "../../persistence/sessionRepository";
import { setState } from "./stateCore";

export const pluginActions = {
  async installPluginManifest(manifest: PluginManifest) {
    setState({
      persistenceError: undefined,
      persistenceMessage: "Installing plugin...",
    });

    const validation = validatePluginManifest(manifest);

    if (!validation.ok) {
      setState({
        persistenceError: validation.errors
          .map((error) => `${error.path}: ${error.message}`)
          .join("\n"),
        persistenceMessage: "Plugin install failed.",
      });
      return null;
    }

    try {
      const repositories = await createRepositories();
      const installedPlugin = await repositories.plugins.install(
        validation.manifest,
      );
      const pluginStatuses = await new PluginManager(
        repositories.plugins,
      ).reload();
      await importCharacterSheetTemplatesFromPlugins(repositories);
      const characterSheetTemplates = (
        await repositories.characterSheets.listTemplates()
      ).map((template) => ({
        ...template,
        fields: normalizeTemplateItems(template.fields),
      }));

      setState({
        pluginStatuses,
        characterSheetTemplates,
        persistenceMessage: `Installed plugin ${installedPlugin.name}.`,
      });

      return installedPlugin;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Plugin install failed.",
      });
      return null;
    }
  },
};
