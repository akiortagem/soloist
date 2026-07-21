import type { Application } from "../../../app/composition/application";
import { pluginErrorText, pluginFailureMessage } from "./pluginMessages";
import type { PluginManifest } from "../../../plugins/pluginTypes";
import { setState } from "../../../state/appStore/stateCore";

export const pluginActions = {
  async installPluginManifest(
    application: Application,
    manifest: PluginManifest,
    options: {
      disableAfterInstall?: boolean;
      enableAfterInstall?: boolean;
    } = {},
  ) {
    setState({
      persistenceError: undefined,
      persistenceMessage: "Installing plugin...",
    });
    try {
      const enabled = options.enableAfterInstall
        ? true
        : options.disableAfterInstall
          ? false
          : undefined;
      const result = await application.installPlugin({ manifest, enabled });
      setState({
        pluginStatuses: result.statuses,
        characterSheetTemplates: result.templates,
        persistenceMessage: `Installed plugin ${result.plugin.name}.`,
      });
      return result.plugin;
    } catch (error) {
      setState({
        persistenceError: pluginErrorText(error),
        persistenceMessage: pluginFailureMessage(
          error,
          "Plugin install",
          "Plugin install failed.",
        ),
      });
      return null;
    }
  },

  async setPluginEnabled(
    application: Application,
    pluginId: string,
    enabled: boolean,
  ) {
    setState({
      persistenceError: undefined,
      persistenceMessage: enabled
        ? "Enabling plugin..."
        : "Disabling plugin...",
    });
    try {
      const result = await (enabled
        ? application.enablePlugin(pluginId)
        : application.disablePlugin(pluginId));
      setState({
        pluginStatuses: result.statuses,
        characterSheetTemplates: result.templates,
        persistenceMessage: `${enabled ? "Enabled" : "Disabled"} plugin ${result.plugin.name}.`,
      });
      return result.plugin;
    } catch (error) {
      setState({
        persistenceError: pluginErrorText(error),
        persistenceMessage: pluginFailureMessage(
          error,
          enabled ? "Plugin enable" : "Plugin disable",
          "Plugin update failed.",
        ),
      });
      return null;
    }
  },

  async reinstallPluginTemplates(application: Application, pluginId: string) {
    setState({
      isSavingTemplate: true,
      persistenceError: undefined,
      persistenceMessage: "Reinstalling plugin templates...",
    });
    try {
      const result = await application.reinstallPluginTemplates(pluginId);
      const activeTemplate =
        result.createdTemplates[0] ?? result.templates[0] ?? null;
      setState({
        characterSheetTemplates: result.templates,
        activeTemplateId: activeTemplate?.id,
        activeTemplate,
        persistenceMessage: `Reinstalled ${result.createdTemplates.length} template${
          result.createdTemplates.length === 1 ? "" : "s"
        } from ${result.plugin.name}.`,
      });
      return result.createdTemplates;
    } catch (error) {
      setState({
        persistenceError: pluginErrorText(error),
        persistenceMessage: pluginFailureMessage(
          error,
          "Plugin template reinstall",
          "Template reinstall failed.",
        ),
      });
      return [];
    } finally {
      setState({ isSavingTemplate: false });
    }
  },

  async uninstallPlugin(application: Application, pluginId: string) {
    setState({
      persistenceError: undefined,
      persistenceMessage: "Uninstalling plugin...",
    });
    try {
      const result = await application.uninstallPlugin(pluginId);
      setState({
        pluginStatuses: result.statuses,
        persistenceMessage: `Uninstalled plugin ${result.plugin?.name ?? pluginId}.`,
      });
      return result.plugin;
    } catch (error) {
      setState({
        persistenceError: pluginErrorText(error),
        persistenceMessage: pluginFailureMessage(
          error,
          "Plugin uninstall",
          "Plugin uninstall failed.",
        ),
      });
      return null;
    }
  },
};
