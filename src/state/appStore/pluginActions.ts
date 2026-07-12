import { invoke } from "@tauri-apps/api/core";
import { normalizeTemplateItems } from "../../characterSheets/characterSheetTemplateLogic";
import {
  importCharacterSheetTemplatesFromPlugins,
  reinstallPluginCharacterSheetTemplate,
} from "../../plugins/characterSheetTemplateImporter";
import { PluginManager } from "../../plugins/pluginManager";
import {
  type PluginManifest,
  validatePluginManifest,
} from "../../plugins/pluginTypes";
import { createRepositories } from "../../persistence/sessionRepository";
import { setState } from "./stateCore";

export const pluginActions = {
  async installPluginManifest(
    manifest: PluginManifest,
    options: { disableAfterInstall?: boolean; enableAfterInstall?: boolean } = {},
  ) {
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
      const plugin = options.enableAfterInstall
        ? await repositories.plugins.setEnabled(installedPlugin.id, true)
        : options.disableAfterInstall
        ? await repositories.plugins.setEnabled(installedPlugin.id, false)
        : installedPlugin;
      const pluginStatuses = await new PluginManager(repositories.plugins).reload();
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
        persistenceMessage: `Installed plugin ${plugin?.name ?? installedPlugin.name}.`,
      });

      return plugin ?? installedPlugin;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Plugin install failed.",
      });
      return null;
    }
  },

  async setPluginEnabled(pluginId: string, enabled: boolean) {
    setState({
      persistenceError: undefined,
      persistenceMessage: enabled ? "Enabling plugin..." : "Disabling plugin...",
    });

    try {
      const repositories = await createRepositories();
      const plugin = await repositories.plugins.setEnabled(pluginId, enabled);

      if (!plugin) {
        setState({
          persistenceError: `Plugin is not installed: ${pluginId}`,
          persistenceMessage: "Plugin update failed.",
        });
        return null;
      }

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
        persistenceMessage: `${enabled ? "Enabled" : "Disabled"} plugin ${plugin.name}.`,
      });

      return plugin;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Plugin update failed.",
      });
      return null;
    }
  },

  async reinstallPluginTemplates(pluginId: string) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
      persistenceMessage: "Reinstalling plugin templates...",
    });

    try {
      const repositories = await createRepositories();
      const plugin = await repositories.plugins.get(pluginId);

      if (!plugin) {
        setState({
          persistenceError: `Plugin is not installed: ${pluginId}`,
          persistenceMessage: "Template reinstall failed.",
        });
        return [];
      }

      const contributions =
        plugin.manifest.contributes?.characterSheetTemplates ?? [];
      const createdTemplates = [];

      for (const contribution of contributions) {
        createdTemplates.push(
          await reinstallPluginCharacterSheetTemplate(repositories, {
            pluginId,
            contributionId: contribution.id,
          }),
        );
      }

      const characterSheetTemplates = (
        await repositories.characterSheets.listTemplates()
      ).map((template) => ({
        ...template,
        fields: normalizeTemplateItems(template.fields),
      }));
      const activeTemplate = createdTemplates[0] ?? characterSheetTemplates[0] ?? null;

      setState({
        characterSheetTemplates,
        activeTemplateId: activeTemplate?.id,
        activeTemplate,
        persistenceMessage: `Reinstalled ${createdTemplates.length} template${
          createdTemplates.length === 1 ? "" : "s"
        } from ${plugin.name}.`,
      });

      return createdTemplates;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Template reinstall failed.",
      });
      return [];
    } finally {
      setState({ isSavingTemplate: false });
    }
  },

  async uninstallPlugin(pluginId: string) {
    setState({
      persistenceError: undefined,
      persistenceMessage: "Uninstalling plugin...",
    });

    try {
      const repositories = await createRepositories();
      const plugin = await repositories.plugins.get(pluginId);

      if (!plugin) {
        setState({
          persistenceError: `Plugin is not installed: ${pluginId}`,
          persistenceMessage: "Plugin uninstall failed.",
        });
        return null;
      }

      await repositories.plugins.uninstall(pluginId);

      try {
        await invoke("uninstall_plugin_folder", { pluginId });
      } catch {
        // The database record is the source of truth; folder cleanup is best effort.
      }

      const pluginStatuses = await new PluginManager(repositories.plugins).reload();

      setState({
        pluginStatuses,
        persistenceMessage: `Uninstalled plugin ${plugin.name}.`,
      });

      return plugin;
    } catch (error) {
      setState({
        persistenceError: error instanceof Error ? error.message : String(error),
        persistenceMessage: "Plugin uninstall failed.",
      });
      return null;
    }
  },
};
