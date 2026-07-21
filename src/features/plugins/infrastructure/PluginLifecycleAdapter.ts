import type { PluginManager } from "../../../plugins/pluginManager";
import type { PluginLifecycle } from "../application/ports/PluginPorts";
import type { PluginContributionCleanup } from "../application/ports/PluginContributionCleanup";

export class PluginLifecycleAdapter implements PluginLifecycle {
  constructor(
    private readonly manager: PluginManager,
    private readonly cleanup: PluginContributionCleanup,
  ) {}

  reload() {
    return this.manager.reload();
  }

  unregister(pluginId: string) {
    this.cleanup.unregister(pluginId);
  }
}
