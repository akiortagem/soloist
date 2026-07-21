import { unregisterPluginOracleProviders } from "../../../oracle/oracleRegistry";
import { pluginUiRegistry } from "../../../plugins/pluginUiRegistry";
import type { PluginContributionCleanup } from "../application/ports/PluginContributionCleanup";

export class GlobalPluginContributionCleanup implements PluginContributionCleanup {
  unregister(pluginId: string): void {
    pluginUiRegistry.unregisterPlugin(pluginId);
    unregisterPluginOracleProviders(pluginId);
  }
}
