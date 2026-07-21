import { PluginApplicationError } from "./PluginApplicationError";
import type {
  InstalledPlugin,
  PluginFiles,
  PluginLifecycle,
  PluginRepository,
} from "./ports/PluginPorts";
import type { PluginStatus } from "../domain/PluginStatus";

export function createUninstallPlugin(dependencies: {
  plugins: PluginRepository;
  lifecycle: PluginLifecycle;
  files: PluginFiles;
}) {
  return async function uninstallPlugin(pluginId: string): Promise<{
    plugin: InstalledPlugin | null;
    statuses: PluginStatus[];
  }> {
    try {
      const plugin = await dependencies.plugins.get(pluginId);
      if (plugin) await dependencies.plugins.uninstall(pluginId);
      dependencies.lifecycle.unregister(pluginId);
      try {
        await dependencies.files.removeInstalledFolder(pluginId);
      } catch {
        // Persistence is authoritative; filesystem cleanup remains best effort.
      }
      try {
        return { plugin, statuses: await dependencies.lifecycle.reload() };
      } catch (error) {
        throw new PluginApplicationError(
          "uninstall_failed",
          error,
          [pluginId],
          "refresh",
          true,
        );
      }
    } catch (error) {
      if (error instanceof PluginApplicationError) throw error;
      throw new PluginApplicationError("uninstall_failed", error);
    }
  };
}
