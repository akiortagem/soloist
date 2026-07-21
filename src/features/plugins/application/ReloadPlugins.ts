import type {
  PluginLifecycle,
  PluginTemplates,
  PluginView,
} from "./ports/PluginPorts";
import { PluginApplicationError } from "./PluginApplicationError";

type ReloadPluginsDependencies = {
  lifecycle: PluginLifecycle;
  templates: PluginTemplates;
};

export function createReloadPlugins(dependencies: ReloadPluginsDependencies) {
  return async function reloadPlugins(): Promise<PluginView> {
    try {
      const statuses = await dependencies.lifecycle.reload();
      await dependencies.templates.refresh();
      return { statuses, templates: await dependencies.templates.list() };
    } catch (error) {
      if (error instanceof PluginApplicationError) throw error;
      throw new PluginApplicationError("reload_failed", error);
    }
  };
}
