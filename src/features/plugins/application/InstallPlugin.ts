import { validatePluginManifest } from "../../../plugins/pluginTypes";
import type { PluginManifest } from "../../../plugins/pluginTypes";
import { PluginApplicationError } from "./PluginApplicationError";
import type {
  InstalledPlugin,
  PluginRepository,
  PluginView,
} from "./ports/PluginPorts";

export type InstallPluginInput = {
  manifest: PluginManifest;
  enabled?: boolean;
};

export type InstallPluginOutput = PluginView & { plugin: InstalledPlugin };

export function createInstallPlugin(dependencies: {
  plugins: PluginRepository;
  reloadPlugins: () => Promise<PluginView>;
}) {
  return async function installPlugin(
    input: InstallPluginInput,
  ): Promise<InstallPluginOutput> {
    const validation = validatePluginManifest(input.manifest);
    if (!validation.ok) {
      throw new PluginApplicationError(
        "invalid_manifest",
        undefined,
        validation.errors.map(({ path, message }) => `${path}: ${message}`),
        "validate",
      );
    }

    try {
      let plugin = await dependencies.plugins.install(validation.manifest);
      if (input.enabled !== undefined && plugin.enabled !== input.enabled) {
        plugin =
          (await dependencies.plugins.setEnabled(plugin.id, input.enabled)) ??
          plugin;
      }
      try {
        return { plugin, ...(await dependencies.reloadPlugins()) };
      } catch (error) {
        throw new PluginApplicationError(
          "install_failed",
          error,
          [plugin.id],
          "refresh",
          true,
        );
      }
    } catch (error) {
      if (error instanceof PluginApplicationError) throw error;
      throw new PluginApplicationError("install_failed", error);
    }
  };
}
