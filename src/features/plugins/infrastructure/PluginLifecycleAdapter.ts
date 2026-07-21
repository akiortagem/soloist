import { unregisterPluginOracleProviders } from "../../../oracle/oracleRegistry";
import type { PluginManager } from "../../../plugins/pluginManager";
import { pluginUiRegistry } from "../../../plugins/pluginUiRegistry";
import type { PluginLifecycle } from "../application/ports/PluginPorts";

export class PluginLifecycleAdapter implements PluginLifecycle {
  constructor(private readonly manager: PluginManager) {}

  reload() {
    return this.manager.reload();
  }

  unregister(pluginId: string) {
    pluginUiRegistry.unregisterPlugin(pluginId);
    unregisterPluginOracleProviders(pluginId);
  }
}
