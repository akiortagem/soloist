import {
  PluginApplicationError,
  pluginNotFound,
} from "./PluginApplicationError";
import type {
  InstalledPlugin,
  PluginRepository,
  PluginView,
} from "./ports/PluginPorts";

type Output = PluginView & { plugin: InstalledPlugin };

function createSetPluginEnabled(
  enabled: boolean,
  dependencies: {
    plugins: PluginRepository;
    reloadPlugins: () => Promise<PluginView>;
  },
) {
  return async function setPluginEnabled(pluginId: string): Promise<Output> {
    try {
      const plugin = await dependencies.plugins.setEnabled(pluginId, enabled);
      if (!plugin) throw pluginNotFound(pluginId);
      try {
        return { plugin, ...(await dependencies.reloadPlugins()) };
      } catch (error) {
        throw new PluginApplicationError(
          enabled ? "enable_failed" : "disable_failed",
          error,
          [plugin.id],
          "refresh",
          true,
        );
      }
    } catch (error) {
      if (error instanceof PluginApplicationError) throw error;
      throw new PluginApplicationError(
        enabled ? "enable_failed" : "disable_failed",
        error,
      );
    }
  };
}

export const createEnablePlugin = (
  dependencies: Parameters<typeof createSetPluginEnabled>[1],
) => createSetPluginEnabled(true, dependencies);

export const createDisablePlugin = (
  dependencies: Parameters<typeof createSetPluginEnabled>[1],
) => createSetPluginEnabled(false, dependencies);
